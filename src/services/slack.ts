import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const slackUrl = process.env.SLACK_WEBHOOK_URL!;
export async function notifySlack(email: any) {
  await axios.post(slackUrl, {
    text: `📧 *New Interested Email*\n*Subject:* ${email.subject}\n*From:* ${email.from.text}`
  });
}
