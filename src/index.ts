import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { connectIMAP } from './imap/imapClient';
import { indexEmail, esClient } from './services/elasticsearch';
import { categorizeEmail } from './services/aiCategorizer';
import { notifySlack } from './services/slackNotifier';
import { triggerWebhook } from './services/webhookTrigger';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Read the target Elasticsearch index from env (fallback: "emails")
const ES_INDEX = process.env.ES_INDEX || 'emails';

// Helper: build Elasticsearch query body
function buildSearchBody(q?: string, account?: string, folder?: string) {
  const must: any[] = [];
  if (q) {
    must.push({
      multi_match: {
        query: q,
        fields: ['subject', 'text', 'from', 'category', 'account']
      }
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
      bool: { must, filter }
    }
  };
}

// GET /emails — list/filter
app.get('/emails', async (req, res) => {
  try {
    const { account, folder } = req.query as any;
    const body = buildSearchBody(undefined, account, folder);
    const { body: esBody } = await esClient.search({ index: ES_INDEX, body });
    const hits = (esBody as any).hits.hits.map((h: any) => h._source);
    res.json(hits);
  } catch (err) {
    console.error('Error fetching emails:', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// GET /emails/search?q=&account=&folder= — full-text search + filters
app.get('/emails/search', async (req, res) => {
  try {
    const { q, account, folder } = req.query as any;
    const body = buildSearchBody(q, account, folder);
    const { body: esBody } = await esClient.search({ index: ES_INDEX, body });
    const hits = (esBody as any).hits.hits.map((h: any) => h._source);
    res.json(hits);
  } catch (err) {
    console.error('Error searching emails:', err);
    res.status(500).json({ error: 'Failed to search emails' });
  }
});

// Start HTTP server
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

// IMAP account definitions
const accounts = [
  {
    user: process.env.IMAP_USER1!,
    password: process.env.IMAP_PASS1!,
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  },
  {
    user: process.env.IMAP_USER2!,
    password: process.env.IMAP_PASS2!,
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  }
];

// Real-time IMAP sync + backfill callback
accounts.forEach(account => {
  connectIMAP(
    account,
    async (email, accountName, isRealTime) => {
      console.log(
        `[${accountName}] New Email (${isRealTime ? 'RT' : 'initial'}): ${email.subject || 'No Subject'}`
      );

      // 1) Categorize via AI/rules
      const category = await categorizeEmail(email.text || '');
      console.log('Category:', category);

      // 2) Index into Elasticsearch (same ES_INDEX)
      await indexEmail(email, accountName, category);

      // 3) Notify Slack + Webhook only for real-time "Interested"
      if (isRealTime && category === 'Interested') {
        await notifySlack({
          from: { text: email.from?.text || 'Unknown Sender' },
          subject: email.subject || 'No Subject',
          date: email.date || new Date()
        });

        await triggerWebhook({
          from: { text: email.from?.text || 'Unknown Sender' },
          subject: email.subject || 'No Subject',
          date: email.date || new Date(),
          text: email.text || ''
        });
      }
    }
  );
});
