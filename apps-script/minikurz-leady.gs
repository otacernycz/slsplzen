/**
 * Pracovní tabulka leadů k minikurzu (sls_minikurz_leady_pracovni).
 *
 * Vložit do tabulky přes Rozšíření → Apps Script, pak:
 *   1. Nastavení projektu → Vlastnosti skriptu: WEB_TOKEN (stejný jako
 *      MINIKURZ_SHEET_TOKEN v ecomail-config.php) a NOTIFY_EMAIL
 *      (adresy oddělené čárkou).
 *   2. Jednou spustit setup() — připraví hlavičku, šířky a rozbalovací stav.
 *   3. Nasadit → Nová verze → Webová aplikace (spouštět jako já, přístup
 *      kdokoli). URL dát do MINIKURZ_SHEET_WEBHOOK v ecomail-config.php.
 *
 * Sloupce drží stejný tvar jako tabulka leadů k akci, jen místo
 * „Vztah k nemovitostem“ jsou „Zkušenosti“ z prvního kroku formuláře.
 */

var HEADERS = ['Datum a čas', 'Jméno', 'Telefon', 'E-mail', 'Zkušenosti', 'Co ho zajímá',
  'Zdroj', 'Stav hovoru', 'Poznámka', 'ID leadu'];
var STAVY = ['Nový', 'Nezvedá', 'Zavolat znovu', 'Schůzka domluvena', 'Nemá zájem'];
var COL_STAV = 8;
var COL_ID = 10;

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
  sh.getRange(2, COL_STAV, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('d. M. yyyy H:mm');
  sh.getRange(2, 3, sh.getMaxRows() - 1, 1).setNumberFormat('@');
}

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

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    var id = 'w:' + Utilities.getUuid().slice(0, 8);
    var zdroj = 'Web – investicniminikurz.cz';
    if (data.zdroj) zdroj += ' · ' + data.zdroj;
    if (data.kampan) zdroj += ' · ' + data.kampan;

    sh.appendRow([new Date(), data.name || '', formatPhone_(data.phone || ''), data.email || '',
      data.zkusenosti || '', data.zajmy || '', zdroj, 'Nový', data.poznamka || '', id]);
    notify_(props.getProperty('NOTIFY_EMAIL'), data, zdroj);
    return json_({ ok: true, id: id });
  } finally {
    lock.releaseLock();
  }
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

function notify_(to, data, zdroj) {
  if (!to) return;
  MailApp.sendEmail({
    to: to,
    subject: 'Nový lead – minikurz: ' + (data.name || data.email),
    body: [
      'Jméno: ' + (data.name || ''),
      'Telefon: ' + formatPhone_(data.phone || ''),
      'E-mail: ' + (data.email || ''),
      'Zkušenosti: ' + (data.zkusenosti || ''),
      'Co ho zajímá: ' + (data.zajmy || ''),
      'Zdroj: ' + zdroj,
      data.poznamka ? 'Pozor: ' + data.poznamka : '',
      '',
      SpreadsheetApp.getActiveSpreadsheet().getUrl()
    ].join('\n')
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
