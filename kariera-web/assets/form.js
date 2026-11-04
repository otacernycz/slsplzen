/* Náborový formulář – Swiss Life Select Plzeň
 *
 * Leady jdou na lead.php, který je zapíše do Google tabulky
 * (záloha Ecomail) a vrátí JSON { success, message } – viz README.md.
 */
(function () {
  'use strict';

  var ENDPOINT = 'lead.php';

  var form = document.getElementById('lead-form');
  if (!form) return;

  var errorBox = form.querySelector('.form-error');
  var submitBtn = form.querySelector('button[type="submit"]');
  var successBox = document.getElementById('form-success');
  var positionInput = form.querySelector('input[name="pozice"]');
  var chips = Array.prototype.slice.call(form.querySelectorAll('.opt.chip'));

  // --- Chipy (výběr jedné možnosti) ---------------------------------------
  function selectChip(value) {
    chips.forEach(function (chip) {
      var on = chip.dataset.value === value;
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    positionInput.value = value;
  }
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () { selectChip(chip.dataset.value); });
  });

  // Odkazy „Mám zájem“ u pozic předvyplní chip (data-preselect="Konzultant")
  document.querySelectorAll('[data-preselect]').forEach(function (link) {
    link.addEventListener('click', function () { selectChip(link.dataset.preselect); });
  });

  // --- UTM parametry z URL (pro vyhodnocení kampaní) ----------------------
  function getUtm() {
    var params = new URLSearchParams(window.location.search);
    var out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      out[k] = params.get(k) || '';
    });
    return out;
  }

  // --- Validace ------------------------------------------------------------
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('visible');
  }
  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('visible');
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }
  function validate() {
    var name = form.jmeno.value.trim();
    var phone = form.telefon.value.trim();
    var email = form.email.value.trim();
    if (!name) { form.jmeno.setAttribute('aria-invalid', 'true'); return 'Vyplňte prosím jméno.'; }
    if (!phone && !email) {
      form.telefon.setAttribute('aria-invalid', 'true');
      form.email.setAttribute('aria-invalid', 'true');
      return 'Nechte nám prosím telefon nebo e-mail.';
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      form.email.setAttribute('aria-invalid', 'true');
      return 'E-mail nevypadá správně.';
    }
    if (phone && phone.replace(/\D/g, '').length < 9) {
      form.telefon.setAttribute('aria-invalid', 'true');
      return 'Telefon nevypadá správně.';
    }
    if (!form.souhlas.checked) return 'Pro odeslání potřebujeme váš souhlas se zpracováním údajů.';
    return '';
  }

  // --- Odeslání ------------------------------------------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    if (form.web && form.web.value) return; // honeypot – bot

    var problem = validate();
    if (problem) { showError(problem); return; }

    var data = Object.assign({
      stranka: form.dataset.source || window.location.pathname,
      pozice: positionInput.value || 'Ještě nevím',
      jmeno: form.jmeno.value.trim(),
      telefon: form.telefon.value.trim(),
      email: form.email.value.trim(),
      zprava: form.zprava ? form.zprava.value.trim() : '',
      souhlas: 'ano'
    }, getUtm());

    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílám…';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString()
    }).then(function (res) {
      return res.json().catch(function () { return {}; });
    }).then(function (result) {
      if (!result.success) throw { serverMessage: result.message };
      form.hidden = true;
      successBox.classList.add('visible');
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: data.pozice });
    }).catch(function (err) {
      showError((err && err.serverMessage) || 'Odeslání se nepovedlo. Zkuste to prosím znovu, nebo nám zavolejte.');
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.label || 'Odeslat';
    });
  });
})();
