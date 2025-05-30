import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
export async function notifySlack(email: {
  from: { text: string };
  subject?: string;
  date?: string | Date;
}) {
  try {
    const url = process.env.SLACK_WEBHOOK_URL!;
    if (!url) {
      throw new Error('SLACK_WEBHOOK_URL is not set in environment variables.');
    }

    const message = {
      text: `📧 *New Interested Email!*\n*From:* ${email.from.text}\n*Subject:* ${email.subject || 'No subject'}\n*Date:* ${email.date || new Date().toISOString()}`,
    };

    await axios.post(url, message);
    console.log('Slack notification sent.');
  } catch (err) {
    console.error('Error sending Slack notification:', err);
  }
}
