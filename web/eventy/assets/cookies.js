// Cookie lišta + Consent Mode v2 – sdílená volba s hlavní stránkou (stejný klíč v localStorage).
(function () {
  'use strict';

  var cookiebar = document.getElementById('cookiebar');
  if (!cookiebar) return;

  function applyConsent(granted) {
    var v = granted ? 'granted' : 'denied';
    if (window.gtag) window.gtag('consent', 'update', { ad_storage: v, analytics_storage: v, ad_user_data: v, ad_personalization: v });
  }
  function setCookieChoice(granted) {
    try { localStorage.setItem('im-cookie-consent', granted ? 'granted' : 'denied'); } catch (e) {}
    applyConsent(granted);
    cookiebar.classList.remove('visible');
  }

  var stored = null;
  try { stored = localStorage.getItem('im-cookie-consent'); } catch (e) {}
  if (stored === 'granted' || stored === 'denied') applyConsent(stored === 'granted');
  else cookiebar.classList.add('visible');

  document.getElementById('cookies-accept').addEventListener('click', function () { setCookieChoice(true); });
  document.getElementById('cookies-reject').addEventListener('click', function () { setCookieChoice(false); });
  var settings = document.getElementById('cookie-settings');
  if (settings) settings.addEventListener('click', function () { cookiebar.classList.add('visible'); });

  // Prokliky na registraci akce – obecná událost + event_id, jako u ostatních stránek akcí.
  document.querySelectorAll('a.event[data-event-id]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.dataLayer) window.dataLayer.push({ event: 'eventy_registrace_klik', event_id: a.dataset.eventId });
    });
  });
})();
