// Fotogalerie: klik na fotku otevře lightbox, šipky / swipe listují, Esc zavře.
// Bez JS odkaz prostě otevře fotku v plné velikosti.
(function () {
  'use strict';

  var items = Array.prototype.slice.call(document.querySelectorAll('a.gallery-item'));
  if (!items.length || typeof HTMLDialogElement !== 'function') return;

  var arrow = function (d) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  };

  var dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Fotogalerie');
  dlg.innerHTML =
    '<span class="lb-count"></span>' +
    '<figure class="lb-figure"><img alt=""><figcaption class="lb-caption"></figcaption></figure>' +
    '<button type="button" class="lb-btn lb-prev" aria-label="Předchozí fotka">' + arrow('m15 18-6-6 6-6') + '</button>' +
    '<button type="button" class="lb-btn lb-next" aria-label="Další fotka">' + arrow('m9 18 6-6-6-6') + '</button>' +
    '<button type="button" class="lb-btn lb-close" aria-label="Zavřít">' + arrow('M18 6 6 18M6 6l12 12') + '</button>';
  document.body.appendChild(dlg);

  var img = dlg.querySelector('img');
  var caption = dlg.querySelector('.lb-caption');
  var count = dlg.querySelector('.lb-count');
  var current = 0;

  function show(i) {
    current = (i + items.length) % items.length;
    var a = items[current];
    var thumb = a.querySelector('img');
    var text = a.getAttribute('data-caption') || (thumb ? thumb.alt : '');
    img.src = a.href;
    img.alt = text;
    caption.textContent = text;
    count.textContent = (current + 1) + ' / ' + items.length;
    // Přednačíst sousední fotky, ať listování necuká.
    [current + 1, current - 1].forEach(function (j) {
      new Image().src = items[(j + items.length) % items.length].href;
    });
  }

  items.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      show(i);
      dlg.showModal();
      if (window.dataLayer) window.dataLayer.push({ event: 'akce_galerie_foto', event_id: document.body.dataset.eventId || '' });
    });
  });

  dlg.querySelector('.lb-prev').addEventListener('click', function () { show(current - 1); });
  dlg.querySelector('.lb-next').addEventListener('click', function () { show(current + 1); });
  dlg.querySelector('.lb-close').addEventListener('click', function () { dlg.close(); });
  // Klik mimo fotku zavře.
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  // Vrátit fokus na fotku až po tom, co prohlížeč dokončí zavření dialogu.
  dlg.addEventListener('close', function () { setTimeout(function () { items[current].focus(); }, 0); });

  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  var startX = null;
  dlg.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    startX = null;
  });
})();
