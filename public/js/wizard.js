/* Formulaire de déclaration de sinistre en 4 étapes - SinistreFlow */
(function () {
  const TYPE_LABELS = {
    AUTO_COLLISION: 'Accident / collision',
    AUTO_VOL: 'Vol du véhicule',
    BRIS_DE_GLACE: 'Bris de glace',
    DEGAT_DES_EAUX: 'Dégât des eaux',
    INCENDIE: 'Incendie',
    CAMBRIOLAGE: 'Cambriolage',
  };
  const THEFT_TYPES = ['AUTO_VOL', 'CAMBRIOLAGE'];

  const state = { contract: null };
  const $ = (sel) => document.querySelector(sel);
  const errorBox = $('#error');

  function showError(message, details) {
    errorBox.innerHTML = '';
    errorBox.append(document.createTextNode(message));
    if (details && details.length) {
      const ul = document.createElement('ul');
      details.forEach((d) => {
        const li = document.createElement('li');
        li.textContent = d;
        ul.append(li);
      });
      errorBox.append(ul);
    }
    errorBox.classList.remove('hidden');
  }

  function clearError() {
    errorBox.classList.add('hidden');
    errorBox.innerHTML = '';
  }

  function goTo(step) {
    clearError();
    document.querySelectorAll('.step').forEach((el) => el.classList.toggle('hidden', Number(el.dataset.step) !== step));
    document.querySelectorAll('#stepper li').forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle('active', n === step);
      li.classList.toggle('done', n < step);
    });
    window.scrollTo(0, 0);
  }

  function collect(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"]').forEach((cb) => { data[cb.name] = cb.checked; });
    Object.assign(state, data);
  }

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error || `Erreur ${res.status}`);
      err.details = json.details;
      throw err;
    }
    return json;
  }

  const frDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '-');
  const euros = (cents) => (cents === null || cents === undefined ? '-'
    : (Number(cents) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));

  function fillRecap(dl, rows) {
    dl.innerHTML = '';
    rows.filter(([, v]) => v !== undefined && v !== null && v !== '').forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    });
  }

  // ---------- Étape 1 : identification ----------
  $('#step-1').addEventListener('submit', async (e) => {
    e.preventDefault();
    collect(e.target);
    try {
      const contract = await api('POST', '/api/public/contracts/verify', {
        contractNumber: state.contractNumber,
        email: state.email,
      });
      state.contract = contract;
      $('#holder-greeting').textContent = `Bonjour ${contract.holder.firstName}, contrat ${contract.contractNumber} (${contract.product.toLowerCase()}).`;
      const select = $('#type');
      select.innerHTML = '<option value="">-- Choisir --</option>';
      contract.allowedTypes.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = TYPE_LABELS[t] || t;
        select.append(opt);
      });
      $('#vehicle-fields').classList.toggle('hidden', contract.product !== 'AUTO');
      $('#incidentDate').max = new Date().toISOString().slice(0, 10);
      goTo(2);
    } catch (err) {
      showError(err.message, err.details);
    }
  });

  // ---------- Étape 2 : le sinistre ----------
  $('#step-2').addEventListener('submit', (e) => {
    e.preventDefault();
    collect(e.target);
    if (!state.type || !state.incidentDate) {
      showError('Merci de renseigner le type et la date du sinistre.');
      return;
    }
    $('#complaint-field').classList.toggle('hidden', !THEFT_TYPES.includes(state.type));
    goTo(3);
  });

  // ---------- Étape 3 : circonstances ----------
  $('#thirdPartyInvolved').addEventListener('change', (e) => {
    $('#third-party-fields').classList.toggle('hidden', !e.target.checked);
  });

  $('#step-3').addEventListener('submit', (e) => {
    e.preventDefault();
    collect(e.target);
    if ((state.description || '').trim().length < 20) {
      showError('La description doit faire au moins 20 caractères.');
      return;
    }
    fillRecap($('#recap'), [
      ['Contrat', state.contract.contractNumber],
      ['Type de sinistre', TYPE_LABELS[state.type]],
      ['Date du sinistre', frDate(state.incidentDate)],
      ['Lieu', state.incidentLocation],
      ['Immatriculation', state.contract.product === 'AUTO' ? state.plate.toUpperCase() : null],
      ['Numéro de plainte', THEFT_TYPES.includes(state.type) ? state.complaintNumber : null],
      ['Tiers impliqué', state.thirdPartyInvolved ? `${state.thirdPartyName} (${state.thirdPartyInsurer || 'assureur inconnu'})` : 'Non'],
      ['Description', state.description],
    ]);
    goTo(4);
  });

  // ---------- Étape 4 : envoi ----------
  $('#step-4').addEventListener('submit', async (e) => {
    e.preventDefault();
    collect(e.target);
    if (!state.certify) {
      showError("Merci de certifier l'exactitude des informations.");
      return;
    }
    const payload = {
      contractNumber: state.contract.contractNumber,
      email: state.email,
      type: state.type,
      incidentDate: state.incidentDate,
      incidentLocation: state.incidentLocation,
      description: state.description,
      complaintNumber: state.complaint_number,
      thirdParty: {
        involved: state.thirdPartyInvolved,
        name: state.thirdPartyName,
        insurer: state.thirdPartyInsurer,
      },
      vehicle: state.contract.product === 'AUTO'
        ? { plate: state.plate, brand: state.brand, model: state.model }
        : null,
      estimatedAmount: state.estimatedAmount,
    };

    const button = $('#submit');
    button.disabled = true;
    try {
      const claim = await api('POST', '/api/public/claims', payload);
      $('#confirm-reference').textContent = claim.reference;
      fillRecap($('#confirm-recap'), [
        ['Type de sinistre', TYPE_LABELS[claim.type]],
        ['Date du sinistre', frDate(claim.incidentDate)],
        ['Montant estimé', euros(claim.estimatedAmountCents)],
        ['Statut', 'Déclaré'],
      ]);
      $('#late-warning').classList.toggle('hidden', !claim.lateDeclaration);
      goTo(5);
    } catch (err) {
      showError(err.message, err.details);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => goTo(Number(btn.dataset.back)));
  });
  $('#restart').addEventListener('click', () => window.location.reload());

  goTo(1);
}());
