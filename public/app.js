const emailsDiv      = document.getElementById('emails');
const btnSearch      = document.getElementById('btnSearch');
const btnRefresh     = document.getElementById('btnRefresh');
const input          = document.getElementById('search');
const accountFilter  = document.getElementById('accountFilter');
const folderFilter   = document.getElementById('folderFilter');

async function fetchEmails(query) {
  const params = new URLSearchParams();
  if (query)                      params.set('q', query);
  if (accountFilter.value)        params.set('account', accountFilter.value);
  if (folderFilter.value)         params.set('folder',  folderFilter.value);

  const url = `/emails${query ? '/search' : ''}?${params.toString()}`;
  const res = await fetch(url);
  return res.json();
}

function render(list) {
  emailsDiv.innerHTML = '';
  if (!list.length) {
    emailsDiv.textContent = 'No emails found.';
    return;
  }
  list.forEach(e => {
    const div = document.createElement('div');
    div.className = 'email';
    div.innerHTML = `
      <div class="subject">${e.subject || 'No Subject'}</div>
      <div class="meta">
        From: ${e.from} — Date: ${new Date(e.date).toLocaleString()}
        <span class="badge">${e.account}</span>
        <span class="badge">${e.category || 'Unknown'}</span>
      </div>
      <div class="body-snippet">${(e.text || '').slice(0, 200)}…</div>
      <button class="toggle">Show More</button>
      <div class="full-body" style="display:none;">${e.text || ''}</div>

      <!-- Reply section -->
      <button class="reply-btn" style="margin-top:8px;">Reply</button>
      <div class="reply-form" style="display:none; margin-top:8px;">
        <textarea class="reply-text" rows="4" style="width:100%;"></textarea>
        <div style="margin-top:4px;">
          <button class="suggest-reply">Suggest Reply</button>
          <button class="send-reply">Send</button>
        </div>
        <p class="reply-error" style="color:red; display:none;"></p>
      </div>
    `;

    // Toggle “Show More”
    const btnToggle = div.querySelector('.toggle');
    const fullBody = div.querySelector('.full-body');
    btnToggle.addEventListener('click', () => {
      const isOpen = fullBody.style.display === 'block';
      fullBody.style.display = isOpen ? 'none' : 'block';
      btnToggle.textContent = isOpen ? 'Show More' : 'Show Less';
    });

    // Toggle Reply Form
    const replyBtn = div.querySelector('.reply-btn');
    const replyForm = div.querySelector('.reply-form');
    replyBtn.addEventListener('click', () => {
      const isOpen = replyForm.style.display === 'block';
      replyForm.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        // Clear previous text & errors
        div.querySelector('.reply-text').value = '';
        const errP = div.querySelector('.reply-error');
        errP.style.display = 'none';
        errP.textContent = '';
      }
    });

    // “Suggest Reply” (now calls /api/suggest-reply)
    const suggestBtn = div.querySelector('.suggest-reply');
    const replyTextarea = div.querySelector('.reply-text');
    const errorP = div.querySelector('.reply-error');
    suggestBtn.addEventListener('click', async () => {
      errorP.style.display = 'none';
      errorP.textContent = '';
      suggestBtn.disabled = true;
      suggestBtn.textContent = 'Thinking…';

      try {
        const payload = {
          subject: e.subject || '',
          body: e.text || ''
        };
        const resp = await fetch('/api/suggest-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const { suggestion } = await resp.json();
        replyTextarea.value = suggestion;
      } catch (err) {
        console.error('Suggest Reply error:', err);
        errorP.textContent = 'Could not fetch suggestion.';
        errorP.style.display = 'block';
      } finally {
        suggestBtn.disabled = false;
        suggestBtn.textContent = 'Suggest Reply';
      }
    });

    // “Send Reply” (unchanged)
    const sendBtn = div.querySelector('.send-reply');
    sendBtn.addEventListener('click', async () => {
      errorP.style.display = 'none';
      errorP.textContent = '';
      const text = replyTextarea.value.trim();
      if (!text) {
        errorP.textContent = 'Reply cannot be empty.';
        errorP.style.display = 'block';
        return;
      }

      // Determine account number: if e.account matches the second Gmail, use "2"
      let accountNum = '1';
      if (e.account === 'yuvrajkhichi99@gmail.com') {
        accountNum = '2';
      }

      const payload = {
        account: accountNum,
        to: e.from,
        subject: `Re: ${e.subject || ''}`,
        body: text,
      };

      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';

      try {
        const resp = await fetch('/api/send-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          throw new Error('Server returned ' + resp.status);
        }
        // Hide form on success
        replyForm.style.display = 'none';
      } catch (err) {
        console.error('Send Reply error:', err);
        errorP.textContent = 'Failed to send reply.';
        errorP.style.display = 'block';
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      }
    });

    emailsDiv.append(div);
  });
}

async function refresh(q = '') {
  const data = await fetchEmails(q);
  render(data);
}

btnRefresh.addEventListener('click', () => {
  input.value = '';
  refresh();
});
btnSearch.addEventListener('click', () => {
  refresh(input.value.trim());
});
accountFilter.addEventListener('change', () => refresh(input.value.trim()));
folderFilter.addEventListener('change', () => refresh(input.value.trim()));

refresh();
setInterval(() => refresh(input.value.trim()), 30000);
