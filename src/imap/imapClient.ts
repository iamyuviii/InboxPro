import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';


function formatSinceDate(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

export function connectIMAP(
  account: {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
  },
  onMail: (email: ParsedMail, accountName: string, isRealTime: boolean) => void
) {
  const imap = new Imap({
    user: account.user,
    password: account.password,
    host: account.host,
    port: account.port,
    tls: account.tls,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 15000
  });

  function openInbox(cb: (err: Error | null, box: Imap.Box) => void) {
    imap.openBox('INBOX', false, cb);
  }

  imap.once('ready', () => {
    openInbox((err, box) => {
      if (err) throw err;
      console.log(`[${account.user}] INBOX opened, ${box.messages.total} messages`);

      // 1) Initial 2-day fetch because as i have too many emails in my inbox 
      const since = formatSinceDate(new Date(Date.now() - 1* 24 * 60 * 60 * 1000));
      imap.search([['SINCE', since]], (searchErr, uids: number[]) => {
        if (searchErr) {
          console.error('Initial search error:', searchErr);
        } else if (uids.length) {
          console.log(`[${account.user}] Initial sync: fetching ${uids.length} messages since ${since}`);
          const fetcher = imap.fetch(uids, { bodies: '', struct: true });
          fetcher.on('message', (msg) => {
            let buffer = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk: Buffer) => { buffer += chunk.toString('utf8'); });
            });
            msg.once('end', () => {
              simpleParser(buffer)
                .then(parsed => onMail(parsed, account.user, false))
                .catch(console.error);
            });
          });
          fetcher.once('error', e => console.error('Fetch error:', e));
        } else {
          console.log(`[${account.user}] No messages in last 30 days.`);
        }
      });

      //  Real-time IDLE
      imap.on('mail', (numNewMsgs: number) => {
        console.log(`[${account.user}] ${numNewMsgs} new message(s) arrived`);
        const start = box.messages.total - numNewMsgs + 1;
        const fetcher = imap.seq.fetch(`${start}:*`, {
          bodies: '', struct: true
        });
        fetcher.on('message', (msg) => {
          let buffer = '';
          msg.on('body', (stream) => {
            stream.on('data', (chunk: Buffer) => { buffer += chunk.toString('utf8'); });
          });
          msg.once('end', () => {
            simpleParser(buffer)
              .then(parsed => onMail(parsed, account.user, true))
              .catch(console.error);
          });
        });
        fetcher.once('error', e => console.error('Real-time fetch error:', e));
      });

    });
  });

  imap.once('error', (err: any) => {
    console.error(`[${account.user}] IMAP Error:`, err);
  });

  imap.connect();
}
