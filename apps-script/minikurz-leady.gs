/**
 * Pracovní tabulka leadů k minikurzu (sls_minikurz_leady_pracovni).
 *
 * Vložit do tabulky přes Rozšíření → Apps Script, pak:
 *   1. Nastavení projektu → Vlastnosti skriptu:
 *      - WEB_TOKEN (stejný jako MINIKURZ_SHEET_TOKEN v ecomail-config.php)
 *      - NOTIFY_EMAIL (adresy oddělené čárkou)
 *      - META_SHEET_ID (ID surové tabulky, do které Meta sama zapisuje leady
 *        z rychlého formuláře — z URL .../spreadsheets/d/{ID}/edit)
 *   2. Jednou spustit setup() — připraví hlavičku, šířky a rozbalovací stav.
 *   3. Jednou spustit installTrigger() — každých 5 minut přenese nové
 *      Meta leady ze surové tabulky (syncMeta).
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
  var rawId = props.getProperty('META_SHEET_ID');
  if (!rawId) return;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return; // doběhne při dalším spuštění
  try {
    var raw = SpreadsheetApp.openById(rawId).getSheets()[0].getDataRange().getValues();
    if (raw.length < 2) return;
    var h = raw[0].map(function (x) { return String(x).trim().toLowerCase(); });
    var col = function (test) {
      for (var i = 0; i < h.length; i++) if (test(h[i])) return i;
      return -1;
    };
    var iId = col(function (x) { return x === 'id'; });
    var iTime = col(function (x) { return x === 'created_time'; });
    var iName = col(function (x) { return x === 'name' || x === 'full_name'; });
    var iEmail = col(function (x) { return x === 'email'; });
    var iPhone = col(function (x) { return x === 'phone' || x === 'phone_number'; });
    var iPlat = col(function (x) { return x === 'platform'; });
    var iZk = col(function (x) { return x.indexOf('zkusenost') !== -1; });
    var iZaj = col(function (x) { return /(^|\|)cil(\||$)|zájem|zajem|informace/.test(x); });
    if (iId === -1 || iEmail === -1) throw new Error('Surová Meta tabulka nemá sloupce id / email.');

    var done = knownIds_();
    for (var r = 1; r < raw.length; r++) {
      var row = raw[r];
      var id = String(row[iId]).trim();
      if (!id || done[id]) continue;
      var email = String(row[iEmail]).trim();
      if (email === 'test@meta.com' || /<test lead/.test(row.join(' '))) continue;

      var created = iTime === -1 ? null : new Date(row[iTime]);
      var plat = iPlat === -1 ? '' : String(row[iPlat]).trim();
      var zdrojMeta = 'Meta – okamžitý formulář' + (plat ? ' · ' + (PLATFORMY[plat] || plat) : '');

      upsert_({
        date: created && !isNaN(created) ? created : new Date(),
        name: iName === -1 ? '' : String(row[iName]).trim(),
        phone: formatPhone_(iPhone === -1 ? '' : String(row[iPhone]).replace(/^p:/, '')),
        email: email,
        zk: iZk === -1 ? [] : String(row[iZk]).split('|').map(metaValue_).filter(String),
        zaj: iZaj === -1 ? [] : String(row[iZaj]).split('|').map(metaValue_).filter(String),
        zdroj: zdrojMeta,
        kind: 'meta',
        poznamka: '',
        id: id
      });
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
  var email = lead.email.toLowerCase();
  var phone9 = digits9_(lead.phone);
  var found = -1;
  for (var r = 1; r < values.length && found === -1; r++) {
    if (email && String(values[r][C.EMAIL]).trim().toLowerCase() === email) found = r;
  }
  for (r = 1; r < values.length && found === -1; r++) {
    if (phone9 && digits9_(values[r][C.TEL]) === phone9) found = r;
  }

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

function notify_(row) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  MailApp.sendEmail({
    to: to,
    subject: 'Nový lead – minikurz: ' + (row[C.JMENO] || row[C.EMAIL]),
    body: [
      'Jméno: ' + row[C.JMENO],
      'Telefon: ' + row[C.TEL],
      'E-mail: ' + row[C.EMAIL],
      'Zkušenosti: ' + row[C.ZK],
      'Co ho zajímá: ' + row[C.ZAJ],
      'Zdroj: ' + row[C.ZDROJ],
      row[C.POZN] ? 'Pozor: ' + row[C.POZN] : '',
      '',
      SpreadsheetApp.getActiveSpreadsheet().getUrl()
    ].join('\n')
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
