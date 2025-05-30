import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const webhookUrl = process.env.WEBHOOK_URL!;
if (!webhookUrl.includes('webhook.site')) {
  console.warn('⚠️ WEBHOOK_URL does not look like a webhook.site URL');
}

export async function triggerWebhook(email: {
  subject?: string;
  from: { text: string };
  date?: string | Date;
  text?: string;
}) {
  try {
    await axios.post(webhookUrl, {
      from:  email.from.text,
      subject: email.subject || 'No Subject',
      date:    email.date || new Date().toISOString(),
      text:    email.text  || ''
    });
    console.log('Webhook triggered successfully.');
  } catch (err) {
    console.error('Error triggering webhook:', err);
  }
}
