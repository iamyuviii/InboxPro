import { Client } from '@elastic/elasticsearch';

export const esClient = new Client({ node: 'http://localhost:9200' });

/**
 * Indexes an email into the "emails" index, including its AI-assigned category.
 * @param email    The parsedMail object from mailparser.
 * @param account  The IMAP account identifier (e.g. email address).
 * @param category The AI-determined category label.
 */
export async function indexEmail(
  email: any,           
  account: string,
  category: string
): Promise<void> {
  await esClient.index({
    index: 'emails',
    body: {
      subject: email.subject || '',
      from: email.from?.text || '',
      to: email.to?.text || '',
      date: email.date || new Date().toISOString(),
      folder: 'INBOX',
      account,
      category,
      text: email.text || '',
      html: email.html || ''
    }
  });
}
