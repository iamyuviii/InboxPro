import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const webhookUrl = process.env.WEBHOOK_URL!;
export async function triggerWebhook(email: {
  subject?: string;
  from: { text: string };
  date?: string | Date;
  text?: string;
}) {
  try {
    await axios.post(webhookUrl, {
      subject: email.subject || 'No Subject',
      from: email.from.text,
      date: email.date || new Date().toISOString(),
      text: email.text || '',
    });
    console.log('Webhook triggered successfully.');
  } catch (err) {
    console.error('Error triggering webhook:', err);
  }
}
