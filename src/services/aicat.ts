import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KEY = process.env.GOOGLE_API_KEY!;
const ENDPOINT = 
  'https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:predict';

const LABELS = [
  'Interested',
  'Meeting Booked',
  'Not Interested',
  'Spam',
  'Out of Office'
].join('\n- ');


export async function categorizeEmail(text: string): Promise<string> {
  const prompt = `
You are an email classifier. Choose exactly one label from the list below that best fits the intent of this email:
- ${LABELS}

Email:
\"\"\"
${text}
\"\"\"

Respond with exactly one of the labels (nothing else).
`;

  const resp = await axios.post(
    `${ENDPOINT}?key=${KEY}`,
    {
      prompt: {
        messages: [{ 
          content: prompt, 
          role: 'user' 
        }]
      },
      temperature: 0,
      candidateCount: 1,
      topP: 0.95
    },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );

  const reply = resp.data?.candidates?.[0]?.content?.trim();
  if (LABELS.includes(reply || '')) {
    return reply!;
  }
  return 'Not Interested';
}
