/* Back-office gestionnaires - SinistreFlow */
(function () {
  const $ = (sel) => document.querySelector(sel);
  let credentials = sessionStorage.getItem('sf-bo') || null;
  let page = 1;

  function showError(message) {
    const box = $('#error');
    box.textContent = message;
    box.classList.toggle('hidden', !message);
  }

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${credentials}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      logout();
      throw new Error(json.error || 'Session expirée');
    }
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
    return json;
  }

  function logout() {
    credentials = null;
    sessionStorage.removeItem('sf-bo');
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    $('#logout').classList.add('hidden');
    $('#whoami').textContent = '';
  }

  const frDate = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
  const euros = (cents) => (cents === null || cents === undefined ? '-'
    : (Number(cents) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));

  function cell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  async function loadList() {
    showError('');
    const params = new URLSearchParams({ page: String(page) });
    if ($('#q').value.trim()) params.set('q', $('#q').value.trim());
    if ($('#status').value) params.set('status', $('#status').value);
    try {
      const result = await api('GET', `/api/internal/claims?${params}`);
      const tbody = $('#rows');
      tbody.innerHTML = '';
      result.items.forEach((c) => {
        const tr = document.createElement('tr');
        tr.className = 'clickable';
        tr.append(cell(c.reference), cell(c.contractNumber), cell(c.type), cell(frDate(c.incidentDate)));
        const st = document.createElement('td');
        st.innerHTML = `<span class="badge">${c.status}</span>${c.lateDeclaration ? ' <span class="badge late">tardive</span>' : ''}`;
        tr.append(st);
        tr.addEventListener('click', () => loadDetail(c.reference));
        tbody.append(tr);
      });
      const pages = result.total ? Math.max(1, Math.ceil(result.total / result.limit)) : '?';
      $('#page-info').textContent = `Page ${page} / ${pages}`;
      $('#prev').disabled = page <= 1;
    } catch (err) {
      showError(err.message);
    }
  }

  function renderDetail(data) {
    const c = data.claim;
    const el = $('#detail');
    el.innerHTML = `
      <h1></h1>
      <p><span class="badge"></span></p>
      <dl class="recap"></dl>
      <h2 style="margin-top:20px">Changer le statut</h2>
      <div class="toolbar" id="transitions"></div>`;
    el.querySelector('h1').textContent = c.reference;
    el.querySelector('.badge').textContent = data.internalStatus;
    const dl = el.querySelector('dl');
    [
      ['Contrat', `${c.contract.number} (${c.contract.product})`],
      ['Type', c.incident.type],
      ['Survenu le', frDate(c.incident.date)],
      ['Lieu', c.incident.location || '-'],
      ['Véhicule', c.vehicle ? `${c.vehicle.plate} ${c.vehicle.brand || ''} ${c.vehicle.model || ''}` : '-'],
      ['Montant estimé', euros(c.amounts.estimatedCents)],
      ['Montant expertisé', euros(c.amounts.assessedCents)],
      ['Franchise', euros(c.contract.deductibleCents)],
      ['Indemnité', euros(c.amounts.indemnityCents)],
      ['Expert', c.expertise ? `${c.expertise.expert.name} (RDV ${frDate(c.expertise.appointmentDate)})` : '-'],
      ['Description', c.incident.description],
    ].forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    });
    const tr = el.querySelector('#transitions');
    if (data.allowedTransitions.length === 0) tr.textContent = 'Dossier clôturé.';
    data.allowedTransitions.forEach((to) => {
      const b = document.createElement('button');
      b.className = 'small';
      b.textContent = `→ ${to}`;
      b.addEventListener('click', async () => {
        try {
          renderDetail(await api('POST', `/api/internal/claims/${c.reference}/transition`, { to }));
          loadList();
        } catch (err) {
          showError(err.message);
        }
      });
      tr.append(b);
    });
  }

  async function loadDetail(reference) {
    try {
      renderDetail(await api('GET', `/api/internal/claims/${encodeURIComponent(reference)}`));
    } catch (err) {
      showError(err.message);
    }
  }

  async function start() {
    try {
      const me = await api('GET', '/api/internal/me');
      $('#whoami').textContent = me.user;
      $('#login').classList.add('hidden');
      $('#app').classList.remove('hidden');
      $('#logout').classList.remove('hidden');
      loadList();
    } catch (err) {
      showError(err.message);
    }
  }

  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    credentials = btoa(`${$('#user').value}:${$('#password').value}`);
    sessionStorage.setItem('sf-bo', credentials);
    start();
  });
  $('#logout').addEventListener('click', (e) => { e.preventDefault(); logout(); });
  $('#filters').addEventListener('submit', (e) => { e.preventDefault(); page = 1; loadList(); });
  $('#prev').addEventListener('click', () => { page = Math.max(1, page - 1); loadList(); });
  $('#next').addEventListener('click', () => { page += 1; loadList(); });

  if (credentials) start();
}());
