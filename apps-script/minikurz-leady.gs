/**
 * Pracovní tabulka leadů k minikurzu (sls_minikurz_leady_pracovni).
 *
 * Vložit do tabulky přes Rozšíření → Apps Script, pak:
 *   1. Nastavení projektu → Vlastnosti skriptu:
 *      - WEB_TOKEN (stejný jako MINIKURZ_SHEET_TOKEN v ecomail-config.php)
 *      - NOTIFY_EMAIL (adresy oddělené čárkou)
 *      - META_SHEET_ID (ID surové tabulky, do které Meta sama zapisuje leady
 *        z rychlého formuláře — z URL .../spreadsheets/d/{ID}/edit)
 *      - META_FORM_IDS (nepovinné; ID Meta formulářů minikurzu oddělená
 *        čárkou, např. f:1071408272074327). Bez něj se berou jen řádky,
 *        jejichž form_name obsahuje „minikurz“ — ostatní kampaně (třeba
 *        spotřebáky) ve stejné surové tabulce se ignorují.
 *      - ECOMAIL_API_KEY (stejný jako v ecomail-config.php) — syncMeta pak
 *        Meta leady sám přihlásí do Ecomailu se štítkem „minikurz“, takže
 *        jim automatizace spustí kurz. Přímé napojení Meta → Ecomail se
 *        pak nepoužívá (bez štítku by je automatizace zařadila jinam).
 *      - ECOMAIL_LIST_ID (nepovinné, výchozí 1)
 *   2. Jednou spustit setup() — připraví hlavičku, šířky a rozbalovací stav.
 *   3. Jednou spustit installTrigger() — každých 5 minut přenese nové
 *      Meta leady ze surové tabulky (syncMeta). Po přidání ECOMAIL_API_KEY
 *      jednou spustit syncMeta ručně, ať si vyžádá přístup k externím službám.
 *   4. Nasadit → Nová verze → Webová aplikace (spouštět jako já, přístup
 *      kdokoli). URL dát do MINIKURZ_SHEET_WEBHOOK v ecomail-config.php.
 *
 * Jeden řádek = jeden člověk. Reklama kombinuje rychlý formulář a web, takže
 * kdo vyplní obojí, nedostane druhý řádek ani druhou notifikaci — jeho řádek
 * se jen doplní (zdroj „+ web“ / „+ Meta“, odpovědi, ID leadu). Páruje se
 * podle e-mailu, a když nesedí, podle posledních 9 číslic telefonu.
 */

var HEADERS = ['Datum a čas', 'Jméno', 'Telefon', 'E-mail', 'Zkušenosti', 'Co ho zajímá',
  'Zdroj', 'Stav hovoru', 'Poznámka', 'ID leadu'];
var STAVY = ['Nový', 'Nezvedá', 'Zavolat znovu', 'Schůzka domluvena', 'Nemá zájem'];
var C = { DATUM: 0, JMENO: 1, TEL: 2, EMAIL: 3, ZK: 4, ZAJ: 5, ZDROJ: 6, STAV: 7, POZN: 8, ID: 9 };

// Odpovědi z Meta formuláře chodí malými písmeny s podtržítky
// („investice_do_nemovitostí“) — převést na přesné texty z webového formuláře,
// ať se u lidí, co vyplní obojí, odpovědi nezdvojí.
var WEB_VALUES = ['Minimální zkušenosti', 'Fondy (ETF, OPF, apod.)', 'Investiční nemovitosti',
  'Alternativní investice (komodity, krypto, apod.)', 'Pokročilé nástroje (FKI, burza CP, apod.)',
  'Investice do nemovitostí', 'Standardní fondy', 'Pokročilé investiční nástroje',
  'Konzultace s profesionálem'];
// Starý formulář měl u zájmů zkrácený text.
var META_VALUES = { 'pokročilé nástroje': 'Pokročilé investiční nástroje' };
var PLATFORMY = { fb: 'Facebook', ig: 'Instagram' };

function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function setup() {
  var sh = sheet_();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#F3F3F3');
  sh.setFrozenRows(1);
  [130, 170, 130, 220, 220, 260, 230, 130, 320, 160].forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  });
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STAVY, true).setAllowInvalid(true).build();
  sh.getRange(2, C.STAV + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('d. M. yyyy H:mm');
  sh.getRange(2, C.TEL + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncMeta') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncMeta').timeBased().everyMinutes(5).create();
}

/* ---------- Web (subscribe.php) ---------- */

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  if (!data.token || data.token !== props.getProperty('WEB_TOKEN')) {
    return json_({ ok: false, error: 'unauthorized' });
  }

  var zdroj = 'Web – investicniminikurz.cz';
  if (data.zdroj) zdroj += ' · ' + data.zdroj;
  if (data.kampan) zdroj += ' · ' + data.kampan;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var res = upsert_({
      date: new Date(),
      name: data.name || '',
      phone: formatPhone_(data.phone || ''),
      email: data.email || '',
      zk: split_(data.zkusenosti),
      zaj: split_(data.zajmy),
      zdroj: zdroj,
      kind: 'web',
      poznamka: data.poznamka || '',
      id: 'w:' + Utilities.getUuid().slice(0, 8)
    });
    return json_({ ok: true, id: res.id, merged: !res.isNew });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Meta (surová tabulka z přímého napojení) ---------- */

function syncMeta() {
  var props = PropertiesService.getScriptProperties();
  // Bere i celý odkaz na tabulku, ne jen ID.
  var rawId = String(props.getProperty('META_SHEET_ID') || '').trim()
    .replace(/^.*\/spreadsheets\/d\/([^/?#]+).*$/, '$1');
  if (!rawId) return;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return; // doběhne při dalším spuštění
  try {
    retryEcomail_();
    var raw = SpreadsheetApp.openById(rawId).getSheets()[0].getDataRange().getValues();
    if (raw.length < 2) return;
    // Názvy sloupců bez diakritiky a oddělovačů: „telefonní__číslo“ → „telefonnicislo“,
    // „e-mail“ → „email“, „*|zkusenosti|*“ → „zkusenosti“.
    var h = raw[0].map(function (x) {
      return String(x).trim().toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
    });
    var col = function () {
      var names = Array.prototype.slice.call(arguments);
      for (var i = 0; i < h.length; i++) if (names.indexOf(h[i]) !== -1) return i;
      return -1;
    };
    var iId = col('id');
    var iTime = col('createdtime');
    var iName = col('name', 'fullname', 'celejmeno');
    var iFirst = col('firstname', 'jmeno');
    var iLast = col('lastname', 'prijmeni');
    var iEmail = col('email');
    var iPhone = col('phone', 'phonenumber', 'telefon', 'telefonnicislo');
    var iPlat = col('platform');
    var iZk = h.findIndex(function (x) { return x.indexOf('zkusenost') !== -1; });
    var iZaj = h.findIndex(function (x) { return x === 'cil' || /zajem|informace/.test(x); });
    var iFormId = col('formid');
    var iFormName = col('formname');
    var iKampan = col('kampan');
    var cell = function (row, i) { return i === -1 ? '' : String(row[i]).trim(); };
    // ID formuláře se bere s i bez prefixu „f:“.
    var bareId = function (x) { return String(x).trim().replace(/^f:/, ''); };
    var formIds = String(props.getProperty('META_FORM_IDS') || '').split(',')
      .map(bareId).filter(String);
    var isMinikurz = function (row) {
      if (formIds.length && iFormId !== -1) return formIds.indexOf(bareId(row[iFormId])) !== -1;
      if (iFormName !== -1) return /minikurz/i.test(String(row[iFormName]));
      return true;
    };
    if (iId === -1 || iEmail === -1) throw new Error('Surová Meta tabulka nemá sloupce id / email.');

    var done = knownIds_();
    for (var r = 1; r < raw.length; r++) {
      var row = raw[r];
      var id = String(row[iId]).trim();
      if (!id || done[id] || !isMinikurz(row)) continue;
      var email = String(row[iEmail]).trim();
      if (email === 'test@meta.com' || /<test lead/.test(row.join(' '))) continue;

      var created = iTime === -1 ? null : new Date(row[iTime]);
      var plat = iPlat === -1 ? '' : String(row[iPlat]).trim();
      var kampan = cell(row, iKampan);
      var zdrojMeta = 'Meta – okamžitý formulář' + (plat ? ' · ' + (PLATFORMY[plat] || plat) : '') +
        (kampan ? ' · ' + kampan : '');

      var lead = {
        date: created && !isNaN(created) ? created : new Date(),
        name: cell(row, iName) || [cell(row, iFirst), cell(row, iLast)].filter(String).join(' '),
        phone: formatPhone_(iPhone === -1 ? '' : String(row[iPhone]).replace(/^p:/, '')),
        email: email,
        zk: iZk === -1 ? [] : String(row[iZk]).split('|').map(metaValue_).filter(String),
        zaj: iZaj === -1 ? [] : String(row[iZaj]).split('|').map(metaValue_).filter(String),
        zdroj: zdrojMeta,
        kind: 'meta',
        poznamka: '',
        id: id
      };
      // Kdo se už přihlásil přes web, minikurz v Ecomailu má.
      var existing = findRow_(sheet_().getDataRange().getValues(), lead.email, lead.phone);
      var viaWeb = existing && /web/i.test(String(existing[C.ZDROJ]));
      if (!viaWeb) {
        var payload = ecomailPayload_(lead, kampan);
        if (!payload) {
          lead.poznamka = 'Chybí ECOMAIL_API_KEY – minikurz neodešel, přidat ručně';
        } else if (!ecomailSubscribe_(payload)) {
          lead.poznamka = ECOMAIL_FAIL;
          var pending = pending_();
          pending[id] = payload;
          savePending_(pending);
        }
      }
      upsert_(lead);
      done[id] = true;
    }
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Společné ---------- */

// Najde řádek téhož člověka a doplní ho, jinak přidá nový a pošle notifikaci.
function upsert_(lead) {
  var sh = sheet_();
  var values = sh.getDataRange().getValues();
  var found = findIndex_(values, lead.email, lead.phone);

  if (found === -1) {
    var row = [lead.date, lead.name, text_(lead.phone), lead.email, lead.zk.join('; '),
      lead.zaj.join('; '), lead.zdroj, 'Nový', lead.poznamka, lead.id];
    sh.appendRow(row);
    sh.getRange(sh.getLastRow(), 1).setNumberFormat('d. M. yyyy H:mm');
    row[C.TEL] = lead.phone;
    notify_(row);
    return { isNew: true, id: lead.id };
  }

  var v = values[found];
  if (!v[C.JMENO]) v[C.JMENO] = lead.name;
  if (!v[C.TEL]) v[C.TEL] = lead.phone;
  v[C.TEL] = text_(v[C.TEL]);
  if (!v[C.EMAIL]) v[C.EMAIL] = lead.email;
  v[C.ZK] = merge_(v[C.ZK], lead.zk);
  v[C.ZAJ] = merge_(v[C.ZAJ], lead.zaj);
  if (String(v[C.ZDROJ]).toLowerCase().indexOf(lead.kind) === -1) {
    v[C.ZDROJ] += lead.kind === 'web' ? ' + web' : ' + ' + lead.zdroj.replace('Meta – okamžitý formulář', 'Meta');
  }
  if (lead.poznamka) v[C.POZN] = v[C.POZN] ? v[C.POZN] + '; ' + lead.poznamka : lead.poznamka;
  v[C.ID] = merge_(v[C.ID], [lead.id], ', ');
  // Datum a stav hovoru zůstávají — první kontakt rozhoduje.
  sh.getRange(found + 1, C.JMENO + 1, 1, HEADERS.length - 1).setValues([v.slice(1)]);
  return { isNew: false, id: lead.id };
}

// Řádek téhož člověka: podle e-mailu, a když nesedí, podle posledních 9 číslic telefonu.
function findIndex_(values, email, phone) {
  email = String(email || '').trim().toLowerCase();
  var phone9 = digits9_(phone);
  for (var r = 1; r < values.length; r++) {
    if (email && String(values[r][C.EMAIL]).trim().toLowerCase() === email) return r;
  }
  for (r = 1; r < values.length; r++) {
    if (phone9 && digits9_(values[r][C.TEL]) === phone9) return r;
  }
  return -1;
}

function findRow_(values, email, phone) {
  var i = findIndex_(values, email, phone);
  return i === -1 ? null : values[i];
}

/* ---------- Ecomail (Meta leady) ---------- */

var ECOMAIL_FAIL = 'Ecomail selhal – minikurz zatím neodešel, zkouším znovu';

// Stejná data a štítky jako subscribe.php, jen se zdrojem „meta“.
function ecomailPayload_(lead, kampan) {
  if (!PropertiesService.getScriptProperties().getProperty('ECOMAIL_API_KEY')) return null;
  var parts = String(lead.name).trim().split(/\s+/);
  var tags = ['minikurz', 'meta'];
  if (kampan) tags.push('kampan-' + kampan.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, ''));
  return {
    subscriber_data: {
      email: lead.email,
      name: parts[0] || '',
      surname: parts.slice(1).join(' '),
      phone: String(lead.phone).replace(/[^0-9+]/g, ''),
      tags: tags,
      custom_fields: { ZKUSENOSTI: lead.zk.join('; '), CIL: lead.zaj.join('; ') }
    },
    trigger_autoresponders: true,
    update_existing: true,
    resubscribe: false
  };
}

function ecomailSubscribe_(payload) {
  var props = PropertiesService.getScriptProperties();
  var listId = props.getProperty('ECOMAIL_LIST_ID') || '1';
  try {
    var res = UrlFetchApp.fetch('https://api2.ecomailapp.cz/lists/' + encodeURIComponent(listId) + '/subscribe', {
      method: 'post',
      contentType: 'application/json',
      headers: { key: props.getProperty('ECOMAIL_API_KEY') },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) return true;
    console.error('Ecomail ' + code + ': ' + res.getContentText());
  } catch (err) {
    console.error('Ecomail: ' + err);
  }
  return false;
}

// Ruční záchrana: kontakty, které v Ecomailu vznikly bez štítku „minikurz“
// a automatizace je minula. V Ecomailu je nejdřív smazat, pak sem doplnit
// e-maily a funkci jednou spustit — přihlásí je znovu podle pracovní tabulky.
var ZNOVU = [];

function prihlasZnovu() {
  if (!PropertiesService.getScriptProperties().getProperty('ECOMAIL_API_KEY')) {
    throw new Error('Chybí ECOMAIL_API_KEY ve vlastnostech skriptu.');
  }
  var values = sheet_().getDataRange().getValues();
  ZNOVU.forEach(function (email) {
    var v = findRow_(values, email, '');
    if (!v) { console.error(email + ': není v pracovní tabulce'); return; }
    var kampan = (String(v[C.ZDROJ]).match(/minikurz-\d{4}-\d{2}/) || [''])[0];
    var payload = ecomailPayload_({
      name: v[C.JMENO], email: v[C.EMAIL], phone: v[C.TEL],
      zk: split_(v[C.ZK]), zaj: split_(v[C.ZAJ])
    }, kampan);
    console.log(email + ': ' + (ecomailSubscribe_(payload) ? 'přihlášen' : 'SELHALO'));
  });
}

// Neúspěšná přihlášení se zkouší znovu při každém dalším syncMeta.
function pending_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('ECOMAIL_PENDING') || '{}');
  } catch (err) {
    return {};
  }
}

function savePending_(pending) {
  PropertiesService.getScriptProperties().setProperty('ECOMAIL_PENDING', JSON.stringify(pending));
}

function retryEcomail_() {
  var pending = pending_();
  var ids = Object.keys(pending);
  if (!ids.length) return;
  var sh = sheet_();
  var values = sh.getDataRange().getValues();
  ids.forEach(function (id) {
    if (!ecomailSubscribe_(pending[id])) return;
    delete pending[id];
    // Poznámku o selhání z řádku zase odebrat.
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][C.ID]).split(/,\s*/).indexOf(id) === -1) continue;
      var pozn = String(values[r][C.POZN]).split(/;\s*/)
        .filter(function (x) { return x && x !== ECOMAIL_FAIL; }).join('; ');
      sh.getRange(r + 1, C.POZN + 1).setValue(pozn);
    }
  });
  savePending_(pending);
}

function knownIds_() {
  var ids = {};
  sheet_().getDataRange().getValues().slice(1).forEach(function (v) {
    String(v[C.ID]).split(/,\s*/).forEach(function (id) { if (id) ids[id] = true; });
  });
  return ids;
}

function merge_(current, add, sep) {
  sep = sep || '; ';
  var list = current ? String(current).split(sep === '; ' ? /;\s*/ : /,\s*/) : [];
  var lower = list.map(function (x) { return x.toLowerCase(); });
  add.forEach(function (x) {
    if (x && lower.indexOf(x.toLowerCase()) === -1) { list.push(x); lower.push(x.toLowerCase()); }
  });
  return list.join(sep);
}

function split_(s) {
  return String(s || '').split(';').map(function (x) { return x.trim(); }).filter(String);
}

function metaValue_(v) {
  var s = String(v || '').replace(/_/g, ' ').trim();
  if (!s) return '';
  var lower = s.toLowerCase();
  if (META_VALUES[lower]) return META_VALUES[lower];
  for (var i = 0; i < WEB_VALUES.length; i++) {
    if (WEB_VALUES[i].toLowerCase() === lower) return WEB_VALUES[i];
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// „+420 …“ by Tabulky vzaly jako vzorec (#ERROR!) — apostrof vynutí text.
function text_(v) {
  v = String(v || '');
  return /^[+=-]/.test(v) ? "'" + v : v;
}

function digits9_(phone) {
  var d = String(phone || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
}

// „420777123456“ / „777123456“ → „+420 777 123 456“, jako v tabulce k akci.
function formatPhone_(phone) {
  var d = String(phone).replace(/\D/g, '');
  if (d.length === 9) d = '420' + d;
  if (d.length === 12 && d.indexOf('420') === 0) {
    return '+420 ' + d.slice(3, 6) + ' ' + d.slice(6, 9) + ' ' + d.slice(9);
  }
  return phone;
}

// Notifikace ve stejném stylu jako u Životního pojištění. První díl chodí
// druhý den ráno a pak denně, takže pátý (poslední) díl přijde 5. den po
// přihlášení — od dalšího dne je čas volat.
var DNY = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

function notify_(row) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  var tz = Session.getScriptTimeZone();
  var prislo = row[C.DATUM] instanceof Date ? row[C.DATUM] : new Date();
  var konec = new Date(prislo.getTime() + 5 * 24 * 3600 * 1000);
  var den = function (d) {
    return DNY[Number(Utilities.formatDate(d, tz, 'u')) % 7] + ' ' + Utilities.formatDate(d, tz, 'd. M. yyyy');
  };
  var konecText = den(konec);
  var jmeno = row[C.JMENO] || row[C.EMAIL];
  var tel = String(row[C.TEL] || '');
  var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  var radky = [
    ['Jméno', esc_(row[C.JMENO])],
    ['Telefon', tel ? '<a href="tel:' + tel.replace(/\s/g, '') + '">' + esc_(tel) + '</a>' : ''],
    ['E-mail', esc_(row[C.EMAIL])],
    ['Zkušenosti', esc_(row[C.ZK])],
    ['Co ho zajímá', esc_(row[C.ZAJ])],
    ['Zdroj', esc_(row[C.ZDROJ])],
    ['Přišlo', Utilities.formatDate(prislo, tz, 'd. M. yyyy H:mm')],
    ['Kurz končí', konecText + ' (poslední díl)']
  ].filter(function (r) { return r[1]; });

  var td = 'padding:4px 16px 4px 0;color:#808080';
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#333">' +
    '<p style="margin:0 0 12px">Nový zájemce o <b>minikurz</b>. Kurz mu skončí <b>' + konecText +
    '</b>, pak je čas zavolat.</p>' +
    (row[C.POZN] ? '<p style="margin:0 0 12px;color:#D82034"><b>Pozor:</b> ' + esc_(row[C.POZN]) + '</p>' : '') +
    '<table style="border-collapse:collapse">' +
    radky.map(function (r) {
      return '<tr><td style="' + td + '">' + r[0] + '</td><td style="padding:4px 0"><b>' + r[1] + '</b></td></tr>';
    }).join('') +
    '</table>' +
    '<p style="margin:16px 0 0"><a href="' + url + '" style="color:#D82034">Otevřít pracovní tabulku →</a></p></div>';

  MailApp.sendEmail({
    to: to,
    subject: 'Nový lead: ' + jmeno + ' – Minikurz',
    body: 'Nový lead (minikurz): ' + jmeno + ', ' + tel + ', ' + row[C.EMAIL] +
      '\nKurz končí ' + konecText + (row[C.POZN] ? '\nPozor: ' + row[C.POZN] : '') + '\n' + url,
    htmlBody: html
  });
}

function esc_(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
