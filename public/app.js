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
    `;

    const btn = div.querySelector('.toggle');
    const fb  = div.querySelector('.full-body');
    btn.addEventListener('click', () => {
      const isOpen = fb.style.display === 'block';
      fb.style.display = isOpen ? 'none' : 'block';
      btn.textContent    = isOpen ? 'Show More' : 'Show Less';
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
