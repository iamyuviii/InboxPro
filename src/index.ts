import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import path from 'path';
import axios from 'axios';
import nodemailer from 'nodemailer';
import OpenAI from 'openai';

import { connectIMAP } from './imap/imapClient';
import { indexEmail, esClient } from './services/elasticsearch';
import { categorizeEmail } from './services/aiCategorizer';
import { notifySlack } from './services/slackNotifier';
import { triggerWebhook } from './services/webhookTrigger';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─────────────────────────────────────────────────────────────
// OpenAI Client Initialization
// ─────────────────────────────────────────────────────────────
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.error('Error: OPENAI_API_KEY not set in .env');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: openaiApiKey });

// ─────────────────────────────────────────────────────────────
// SMTP Transporters
// ─────────────────────────────────────────────────────────────
function makeTransporter1() {
  return nodemailer.createTransport({
    host: process.env.SMTP1_HOST,
    port: parseInt(process.env.SMTP1_PORT || '587', 10),
    secure: process.env.SMTP1_SECURE === 'true',
    auth: {
      user: process.env.SMTP1_USER,
      pass: process.env.SMTP1_PASS,
    },
  });
}

function makeTransporter2() {
  return nodemailer.createTransport({
    host: process.env.SMTP2_HOST,
    port: parseInt(process.env.SMTP2_PORT || '587', 10),
    secure: process.env.SMTP2_SECURE === 'true',
    auth: {
      user: process.env.SMTP2_USER,
      pass: process.env.SMTP2_PASS,
    },
  });
}

// Elasticsearch setup
const ES_INDEX = process.env.ES_INDEX || 'emails';

function buildSearchBody(q?: string, account?: string, folder?: string) {
  const must: any[] = [];
  if (q) {
    must.push({
      multi_match: {
        query: q,
        fields: ['subject', 'text', 'from', 'category', 'account'],
      },
    });
  }

  const filter: any[] = [];
  if (account && account !== 'All') {
    filter.push({ term: { 'account.keyword': account } });
  }
  if (folder && folder !== 'All') {
    filter.push({ term: { 'folder.keyword': folder } });
  }

  return {
    size: 100,
    sort: [{ date: { order: 'desc' } }],
    query: {
      bool: { must, filter },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Routes: Fetch & Search Emails
// ─────────────────────────────────────────────────────────────
app.get('/emails', async (req: Request, res: Response): Promise<void> => {
  try {
    const { account, folder } = req.query as { account?: string; folder?: string };
    const body = buildSearchBody(undefined, account, folder);
    const { body: esBody } = await esClient.search({ index: ES_INDEX, body });
    const hits = (esBody as any).hits.hits.map((h: any) => h._source);
    res.json(hits);
  } catch (err) {
    console.error('Error fetching emails:', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

app.get('/emails/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, account, folder } = req.query as { q?: string; account?: string; folder?: string };
    const body = buildSearchBody(q, account, folder);
    const { body: esBody } = await esClient.search({ index: ES_INDEX, body });
    const hits = (esBody as any).hits.hits.map((h: any) => h._source);
    res.json(hits);
  } catch (err) {
    console.error('Error searching emails:', err);
    res.status(500).json({ error: 'Failed to search emails' });
  }
});

// ─────────────────────────────────────────────────────────────
// Test Email Route (Simulated Incoming Email)
// ─────────────────────────────────────────────────────────────
app.post('/test-email', async (req: Request, res: Response): Promise<void> => {
  try {
    interface FakeEmail {
      subject?: string;
      body?: string;
      date?: string;
      from?: string;
      text?: string;
    }
    const fakeEmail = req.body as FakeEmail;

    const email = {
      ...fakeEmail,
      date: new Date(fakeEmail.date || Date.now()),
      from: { text: fakeEmail.from || 'test@example.com' },
      text: fakeEmail.text || fakeEmail.body || '',
    };

    const accountName = 'test@example.com';
    const isRealTime = true;

    const category = await categorizeEmail(email.text);
    console.log(`[Test] Simulated Email: ${email.subject} → ${category}`);

    await indexEmail(email, accountName, category);

    if (category === 'Interested') {
      await notifySlack({
        from: { text: email.from.text },
        subject: email.subject || 'No Subject',
        date: email.date,
      });

      await triggerWebhook({
        from: { text: email.from.text },
        subject: email.subject || 'No Subject',
        date: email.date,
        text: email.text,
      });
    }

    res.status(200).json({ message: 'Simulated email processed successfully', category });
  } catch (err) {
    console.error('Error in /test-email:', err);
    res.status(500).json({ error: 'Failed to process test email' });
  }
});

// ─────────────────────────────────────────────────────────────
// Suggest Reply via OpenAI ChatCompletion
// ─────────────────────────────────────────────────────────────
app.post('/api/suggest-reply', async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, body } = req.body as { subject?: string; body?: string };
    if (!subject || !body) {
      res.status(400).json({ error: 'Missing subject or body.' });
      return;
    }

    // Build the chat prompt
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that writes brief, polite email replies.',
      },
      {
        role: 'user',
        content:
          `Original email subject: "${subject}"\n\n` +
          `Original email body:\n${body}\n\n` +
          `Please compose a polite, concise reply (2–3 sentences) in a friendly, professional tone.`,
      },
    ];

   const completion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages,
  temperature: 0.7,
  max_tokens: 150,
});

    const suggestion = completion.choices[0].message?.content?.trim();
    if (!suggestion) {
      res.status(500).json({ error: 'OpenAI returned no suggestion.' });
      return;
    }

    res.json({ suggestion });
  } catch (err: any) {
    console.error('OpenAI error in /api/suggest-reply:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to generate reply via OpenAI.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Send Email Reply
// ─────────────────────────────────────────────────────────────
app.post('/api/send-reply', async (req: Request, res: Response): Promise<void> => {
  interface SendReplyBody {
    account: '1' | '2';
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
  }
  const { account, to, subject, body, inReplyTo } = req.body as SendReplyBody;

  if (!account || (account !== '1' && account !== '2')) {
    res.status(400).json({ error: 'Missing or invalid "account". Must be "1" or "2".' });
    return;
  }
  if (!to || !subject || !body) {
    res.status(400).json({ error: 'Missing to, subject, or body.' });
    return;
  }

  let transporter;
  if (account === '1') {
    transporter = makeTransporter1();
  } else {
    transporter = makeTransporter2();
  }

  const headers: Record<string, string> = {};
  if (inReplyTo) {
    headers['In-Reply-To'] = inReplyTo;
  }

  try {
    await transporter.sendMail({
      from: account === '1' ? process.env.SMTP1_USER! : process.env.SMTP2_USER!,
      to,
      subject,
      headers,
      text: body,
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error sending email:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

// ─────────────────────────────────────────────────────────────
// IMAP: Connect and Process Incoming Emails
// ─────────────────────────────────────────────────────────────
const accounts = [
  {
    user: process.env.IMAP_USER1!,
    password: process.env.IMAP_PASS1!,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
  },
  {
    user: process.env.IMAP_USER2!,
    password: process.env.IMAP_PASS2!,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
  },
] as const;

accounts.forEach((accountConfig) => {
  connectIMAP(accountConfig, async (email: any, accountName: string, isRealTime: boolean) => {
    console.log(
      `[${accountName}] New Email (${isRealTime ? 'RT' : 'initial'}): ${email.subject || 'No Subject'}`
    );

    const category = await categorizeEmail(email.text || '');
    console.log('Category:', category);

    await indexEmail(email, accountName, category);

    if (isRealTime && category === 'Interested') {
      await notifySlack({
        from: { text: email.from?.text || 'Unknown Sender' },
        subject: email.subject || 'No Subject',
        date: email.date || new Date(),
      });

      await triggerWebhook({
        from: { text: email.from?.text || 'Unknown Sender' },
        subject: email.subject || 'No Subject',
        date: email.date || new Date(),
        text: email.text || '',
      });
    }
  });
});
//aaaa
