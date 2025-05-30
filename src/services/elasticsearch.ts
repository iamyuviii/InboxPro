import { Client } from '@elastic/elasticsearch';

export const esClient = new Client({
  node: process.env.ES_NODE, // e.g. https://my-elasticsearch-project-xxxx.es.us-east-1.aws.elastic.cloud:443
  auth: {
    username: process.env.ES_USERNAME || '',
    password: process.env.ES_PASSWORD || '',
  },
  ssl: {
    rejectUnauthorized: false, // optionally disable SSL validation (if needed)
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
  await esClient.index({
    index: process.env.ES_INDEX || 'emails', // use your .env-configured index
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
}
