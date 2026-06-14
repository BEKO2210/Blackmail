/**
 * AEGIS Auto-Switch — frontend for the hosted (Cloudflare Worker) service.
 * Talks to window.AEGIS_SERVICE_API. No local crypto here — this flow is the
 * zero-setup, active-email-notification service.
 */
(function () {
  'use strict';

  function api() {
    return (window.AEGIS_SERVICE_API || '').replace(/\/+$/, '');
  }

  function addGuardianRow(prefill) {
    var container = document.getElementById('guardianRows');
    var row = document.createElement('div');
    row.className = 'guardian-row';
    row.innerHTML =
      '<input type="email" class="form-input g-email" placeholder="' +
        escapeHtml(AegisLang.t('protect.guardian.email')) + '" autocomplete="off">' +
      '<input type="text" class="form-input g-name" placeholder="' +
        escapeHtml(AegisLang.t('protect.guardian.name')) + '" autocomplete="off">' +
      '<button type="button" class="btn btn-ghost g-remove" aria-label="remove">&#x2715;</button>';
    container.appendChild(row);
    row.querySelector('.g-remove').addEventListener('click', function () {
      row.remove();
    });
    if (prefill) {
      row.querySelector('.g-email').value = prefill.email || '';
      row.querySelector('.g-name').value = prefill.name || '';
    }
  }

  function collectGuardians() {
    var rows = document.querySelectorAll('#guardianRows .guardian-row');
    var out = [];
    rows.forEach(function (r) {
      var email = r.querySelector('.g-email').value.trim();
      var name = r.querySelector('.g-name').value.trim();
      if (email) out.push({ email: email, name: name });
    });
    return out;
  }

  function showError(msg) {
    var el = document.getElementById('protectError');
    el.classList.remove('hidden');
    document.getElementById('protectErrorText').textContent = msg;
  }
  function hideError() {
    document.getElementById('protectError').classList.add('hidden');
  }

  async function submit() {
    hideError();
    if (!api()) {
      showError(AegisLang.t('protect.notconfigured'));
      return;
    }
    var email = document.getElementById('ownerEmail').value.trim();
    var guardians = collectGuardians();
    if (!email) { showError(AegisLang.t('protect.error.email')); return; }
    if (!guardians.length) { showError(AegisLang.t('protect.error.guardians')); return; }

    var payload = {
      owner_email: email,
      interval_hours: parseInt(document.getElementById('pInterval').value, 10),
      grace_hours: parseInt(document.getElementById('pGrace').value, 10),
      reminder_hours: parseInt(document.getElementById('pReminder').value, 10),
      message: document.getElementById('pMessage').value,
      evidence_url: document.getElementById('pEvidence').value.trim(),
      guardians: guardians
    };

    var btn = document.getElementById('createSwitchBtn');
    btn.disabled = true;
    var orig = btn.innerHTML;
    btn.innerHTML = AegisIcons.loader + ' ' + AegisLang.t('protect.creating');

    try {
      var resp = await fetch(api() + '/api/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || ('HTTP ' + resp.status));

      document.getElementById('protectForm').classList.add('hidden');
      var ok = document.getElementById('protectSuccess');
      ok.classList.remove('hidden');
      ok.scrollIntoView({ behavior: 'smooth' });
      if (data.email_sent === false) {
        document.getElementById('protectSuccessNote').textContent =
          AegisLang.t('protect.success.mailfail');
      }
    } catch (e) {
      showError(AegisLang.t('protect.error.generic') + ' ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  function init() {
    var notice = document.getElementById('serviceNotice');
    if (!api() && notice) notice.classList.remove('hidden');

    addGuardianRow();
    addGuardianRow();

    document.getElementById('addGuardianBtn').addEventListener('click', function () {
      addGuardianRow();
    });
    document.getElementById('createSwitchBtn').addEventListener('click', submit);

    document.addEventListener('aegis-lang-change', function () {
      // Refresh dynamic placeholders on language switch.
      document.querySelectorAll('#guardianRows .g-email').forEach(function (i) {
        i.placeholder = AegisLang.t('protect.guardian.email');
      });
      document.querySelectorAll('#guardianRows .g-name').forEach(function (i) {
        i.placeholder = AegisLang.t('protect.guardian.name');
      });
    });
  }

  document.addEventListener('aegis-ready', init);
})();
