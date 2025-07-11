import { Client } from '@elastic/elasticsearch';

const esNode = process.env.ES_NODE;
const esUsername = process.env.ES_USERNAME;
const esPassword = process.env.ES_PASSWORD;
const esIndex = process.env.ES_INDEX || 'emails';

if (!esNode || !esUsername || !esPassword) {
  throw new Error('Missing Elasticsearch environment variables.');
}

export const esClient = new Client({
  node: esNode,
  auth: {
    username: esUsername,
    password: esPassword,
  },
  ssl: {
    rejectUnauthorized: false, // only for dev/test
  },
});

/**
 * Indexes an email into the specified index with AI category.
 */
export async function indexEmail(
  email: any,
  account: string,
  category: string
): Promise<void> {
  try {
    const response = await esClient.index({
      index: esIndex,
      body: {
        subject: email.subject || '',
        from: email.from?.text || '',
        to: email.to?.text || '',
        date: email.date || new Date().toISOString(),
        folder: 'INBOX',
        account,
        category,
        text: email.text || '',
        html: email.html || '',
      },
    });
    console.log('Document indexed:', response);
  } catch (err: any) {
    console.error('Failed to index email:', err?.meta?.body?.error || err.message);
    throw err;
  }
}
