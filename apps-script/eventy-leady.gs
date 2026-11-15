/**
 * Leady z akcí (eventů) → čitelná pracovní tabulka + e-mailová notifikace
 * Swiss Life Select Plzeň — společné pro všechny akce.
 *
 * Kde skript žije: Rozšíření → Apps Script v SUROVÉ Meta tabulce
 * (sls_event_13_10_2026_leady). Do pracovní tabulky zapisuje přes její ID.
 *
 * Jak to funguje:
 *  - Každých 5 minut projde VŠECHNY listy surové tabulky, které mají sloupec
 *    „id" (= list, kam zapisuje Meta). Nový Meta rychlý formulář tedy stačí
 *    nechat zapisovat do nového listu téhle tabulky a skript si ho najde sám.
 *  - Leady z webu posílá registrace.php rovnou sem (doPost).
 *  - Akci pozná podle event_id: web ho posílá vždy, do Meta formuláře přidat
 *    skryté pole event_id (např. renta_11_2026). Bez něj vezme název formuláře.
 *  - V pracovní tabulce se nic nepřepisuje, jen přidávají řádky.
 *
 * Nová akce: přidat řádek do AKCE níže (event_id → název do tabulky a e-mailu).
 *
 * POZOR — pracuje se se sloupci podle pořadí. Sloupec „ID leadu" musí být
 * vždy poslední sloupec z HLAVICKA (podle něj se hlídají duplicity).
 * Po změně kódu: Nasadit → Spravovat nasazení → upravit (tužka) → Verze:
 * Nová verze → Nasadit. Jinak web dál volá starou verzi. URL zůstane stejná.
 */

// ====== NASTAVENÍ ======
const ZDROJ_LIST = '';            // list, kam zapisuje Meta ('' = všechny listy se sloupcem „id")
const CIL_TABULKA_ID = '17GmYT-6VjH4h8K5ed1doZpvoUbAVNCFS3tPcABGsJjU'; // pracovní tabulka
const PRACOVNI_LIST = '';         // list v pracovní tabulce ('' = první list)
const EMAILY = 'DOPLNIT';         // komu posílat notifikace, víc adres oddělte čárkou — nechat ze stávajícího skriptu
const WEB_TOKEN = 'DOPLNIT';      // stejné jako EVENT_SHEET_TOKEN na serveru — nechat ze stávajícího skriptu
// =======================

// event_id → název akce (do sloupce „Akce" a do předmětu e-mailu)
const AKCE = {
  nemovitosti_10_2026: 'Od nájmu k výnosu · 13. 10. 2026',
  renta_11_2026: 'Švýcarská renta a daňové úlevy · 26. 11. 2026',
};

const HLAVICKA = [
  'Datum a čas', 'Akce', 'Jméno', 'Telefon', 'E-mail',
  'Situace', 'Co ho zajímá', 'Zdroj',
  'Stav hovoru', 'Poznámka', 'ID leadu',
];
const SL_STAV = 9; // sloupec „Stav hovoru" (1 = A)

// Hezké názvy odpovědí (Meta je ukládá malými písmeny s podtržítky).
// Co tu není, převede se samo: podtržítka na mezery, velké první písmeno.
const ODPOVEDI = {
  'už_pronajímám': 'Už pronajímám',
  'plánuji_první_koupi': 'Plánuji první koupi',
  'zvažuji_nemovitostní_fondy': 'Zvažuji nemovitostní fondy',
  'zatím_se_jen_zajímám': 'Zatím se jen zajímám',
  'výběr_nemovitosti_a_nájemníka': 'Výběr nemovitosti a nájemníka',
  'smlouva_a_rizika': 'Smlouva a rizika',
  'daně_z_pronájmu': 'Daně z pronájmu',
  'nemovitostní_fondy': 'Nemovitostní fondy',
};

// Začátky názvů sloupců s odpověďmi v Meta formulářích (otázka „Situace" a „Co vás zajímá")
const SLOUPCE_SITUACE = ['jaký_máte_vztah', 'jak_jste_na_tom', 'situace', 'vztah'];
const SLOUPCE_ZAJEM = ['co_vás_zajímá', 'zajmy', 'zajem', 'zájem'];

const ZDROJE = {
  meta_instant: 'Meta – okamžitý formulář',
  fb: 'Facebook',
  ig: 'Instagram',
  web: 'Web',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
};

/** Spusť jednou ručně: připraví pracovní list a nastaví kontrolu každých 5 minut. */
function nastavit() {
  pracovniList_();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'zpracujNoveLeady')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('zpracujNoveLeady').timeBased().everyMinutes(5).create();
  zpracujNoveLeady();
}

/** Hlavní funkce — volá ji časovač. Projde všechny listy od Mety. */
function zpracujNoveLeady() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const listy = ZDROJ_LIST ? [ss.getSheetByName(ZDROJ_LIST)] : ss.getSheets();
    if (!listy[0]) throw new Error('Nenašel jsem list „' + ZDROJ_LIST + '".');
    const cil = pracovniList_();
    kontrolaHlavicky_(cil);

    // ID už zpracovaných leadů (poslední sloupec z HLAVICKA)
    const hotovo = new Set();
    const posledni = cil.getLastRow();
    if (posledni > 1) {
      cil.getRange(2, HLAVICKA.length, posledni - 1, 1).getValues()
        .forEach(r => r[0] && hotovo.add(String(r[0])));
    }

    const vem = (row, a, b) => {
      const v = a >= 0 ? row[a] : '';
      return v !== '' ? v : (b >= 0 ? row[b] : '');
    };

    const nove = [];
    listy.forEach(zdroj => {
      const data = zdroj.getDataRange().getDisplayValues();
      if (data.length < 2) return;
      const h = data[0].map(x => String(x).trim().toLowerCase());
      const col = nazev => h.findIndex(x => x === nazev || x.startsWith(nazev));
      const colZ = zacatky => {
        for (const z of zacatky) { const i = col(z); if (i >= 0) return i; }
        return -1;
      };

      const i = {
        id: h.indexOf('id'),
        cas: col('created_time'),
        jmeno: col('name'),
        jmeno2: col('full_name'),
        email: col('email'),
        telefon: col('phone'),
        telefon2: col('phone_number'),
        situace: colZ(SLOUPCE_SITUACE),
        zajem: colZ(SLOUPCE_ZAJEM),
        zdroj: col('zdroj'),
        platforma: col('platform'),
        organic: col('is_organic'),
        akce: col('event_id'),
        formular: col('form_name'),
      };
      if (i.id < 0) return; // list bez sloupce „id" není od Mety, přeskočit

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        const id = String(row[i.id] || '').trim();
        if (!id || hotovo.has(id)) continue;

        const zdrojTxt = [
          hezkyZdroj_(vem(row, i.zdroj, -1)),
          hezkyZdroj_(vem(row, i.platforma, -1)),
          String(vem(row, i.organic, -1)).toLowerCase() === 'true' ? 'organicky' : '',
        ].filter(Boolean).join(' · ');

        nove.push([
          hezkyCas_(vem(row, i.cas, -1)),
          nazevAkce_(vem(row, i.akce, -1), vem(row, i.formular, -1)),
          vem(row, i.jmeno, i.jmeno2),
          hezkyTelefon_(vem(row, i.telefon, i.telefon2)),
          vem(row, i.email, -1),
          hezkaOdpoved_(vem(row, i.situace, -1)),
          hezkaOdpoved_(vem(row, i.zajem, -1)),
          zdrojTxt,
          'Nevoláno',
          '',
          id,
        ]);
        hotovo.add(id);
      }
    });
    if (!nove.length) return;

    cil.getRange(cil.getLastRow() + 1, 1, nove.length, HLAVICKA.length).setValues(nove);
    nove.forEach(posliEmail_);
  } finally {
    lock.releaseLock();
  }
}

/** Příjem registrací z webového formuláře (volá registrace.php). */
function doPost(e) {
  const odpoved = obj => ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return odpoved({ ok: false, error: 'bad json' });
  }
  if (!WEB_TOKEN || d.token !== WEB_TOKEN) return odpoved({ ok: false, error: 'bad token' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cil = pracovniList_();
    kontrolaHlavicky_(cil);
    const kampan = d.kampan ? ' / ' + d.kampan : '';
    const radek = [
      Utilities.formatDate(new Date(), 'Europe/Prague', 'd. M. yyyy H:mm'),
      nazevAkce_(d.event_id, ''),
      String(d.name || ''),
      hezkyTelefon_(d.phone),
      String(d.email || ''),
      hezkaOdpoved_(d.vztah),
      hezkaOdpoved_(d.zajmy),
      ['Web', d.zdroj ? hezkyZdroj_(d.zdroj) + kampan : ''].filter(Boolean).join(' · '),
      'Nevoláno',
      '',
      'web:' + Date.now() + ':' + String(d.email || ''),
    ];
    cil.getRange(cil.getLastRow() + 1, 1, 1, HLAVICKA.length).setValues([radek]);
    posliEmail_(radek);
    return odpoved({ ok: true });
  } catch (err) {
    return odpoved({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- pomocné funkce ----------

function cilTabulka_() {
  return SpreadsheetApp.openById(CIL_TABULKA_ID);
}

/**
 * Pojistka: když hlavička pracovního listu nesedí s HLAVICKA (např. chybí
 * sloupec „Akce"), skript radši spadne, než aby zapsal do špatných sloupců
 * nebo podle špatného sloupce hledal duplicity a poslal hromadu e-mailů.
 */
function kontrolaHlavicky_(sh) {
  const h = sh.getRange(1, 1, 1, HLAVICKA.length).getDisplayValues()[0]
    .map(x => String(x).trim());
  if (h[1] !== 'Akce' || h[HLAVICKA.length - 1] !== 'ID leadu') {
    throw new Error('Pracovní list nemá sloupce ve správném pořadí: čekám „Akce" ve sloupci B ' +
      'a „ID leadu" ve sloupci ' + String.fromCharCode(64 + HLAVICKA.length) + '.');
  }
}

function pracovniList_() {
  const ss = cilTabulka_();
  let sh = PRACOVNI_LIST ? ss.getSheetByName(PRACOVNI_LIST) : ss.getSheets()[0];
  if (!sh) sh = ss.insertSheet(PRACOVNI_LIST);
  if (sh.getLastRow() > 0) return sh; // už připravený (nebo v něm něco je) — nesaháme

  sh.getRange(1, 1, 1, HLAVICKA.length).setValues([HLAVICKA])
    .setFontWeight('bold').setBackground('#D82034').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, HLAVICKA.length, 170);
  sh.setColumnWidth(SL_STAV + 1, 320);
  sh.getRange('D:D').setNumberFormat('@'); // telefon jako text, ať nezmizí +420

  // Rozbalovací seznam pro stav hovoru
  const pravidlo = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Nevoláno', 'Nezvedá', 'Zavolat znovu', 'Potvrzeno', 'Nemá zájem', 'Kapacita – náhradník'], true)
    .build();
  sh.getRange(2, SL_STAV, 1000, 1).setDataValidation(pravidlo);

  // Barvičky podle stavu
  const rozsah = sh.getRange(2, 1, 1000, HLAVICKA.length);
  const sl = String.fromCharCode(64 + SL_STAV);
  const barva = (text, bg) => SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + sl + '2="' + text + '"').setBackground(bg).setRanges([rozsah]).build();
  sh.setConditionalFormatRules([
    barva('Potvrzeno', '#E3F1DF'),
    barva('Nemá zájem', '#EEEEEE'),
    barva('Zavolat znovu', '#FFF4D6'),
    barva('Nezvedá', '#FFF4D6'),
  ]);

  sh.hideColumns(HLAVICKA.length); // ID leadu je jen pro skript
  return sh;
}

function nazevAkce_(eventId, formular) {
  const id = String(eventId || '').trim().toLowerCase();
  if (AKCE[id]) return AKCE[id];
  return id || String(formular || '').trim() || 'Neznámá akce';
}

function hezkyCas_(v) {
  if (!v) return '';
  const d = new Date(String(v));
  if (isNaN(d)) return String(v);
  return Utilities.formatDate(d, 'Europe/Prague', 'd. M. yyyy H:mm');
}

function hezkyTelefon_(v) {
  let t = String(v || '').replace(/^p:/, '').replace(/[^\d+]/g, '');
  if (/^\d{9}$/.test(t)) t = '+420' + t;
  const m = t.match(/^\+420(\d{3})(\d{3})(\d{3})$/);
  return m ? '+420 ' + m[1] + ' ' + m[2] + ' ' + m[3] : t;
}

function hezkaOdpoved_(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  return s.split(/[;,]\s*/).map(x => {
    const k = x.trim().toLowerCase();
    if (ODPOVEDI[k]) return ODPOVEDI[k];
    const t = x.trim().replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }).join('; ');
}

function hezkyZdroj_(v) {
  const k = String(v || '').trim().toLowerCase();
  return ZDROJE[k] || String(v || '').trim();
}

function posliEmail_(r) {
  if (!EMAILY) return;
  const [cas, akce, jmeno, telefon, email, situace, zajem, zdroj] = r;
  const tel = telefon.replace(/\s/g, '');
  const url = cilTabulka_().getUrl();
  const radek = (k, v) => v ? '<tr><td style="padding:4px 16px 4px 0;color:#808080">' + k +
    '</td><td style="padding:4px 0"><b>' + v + '</b></td></tr>' : '';

  MailApp.sendEmail({
    to: EMAILY,
    subject: 'Nový lead: ' + jmeno + ' – ' + akce,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:15px;color:#333">' +
      '<p style="margin:0 0 12px">Nová registrace na akci <b>' + akce + '</b>.</p>' +
      '<table style="border-collapse:collapse">' +
      radek('Jméno', jmeno) +
      radek('Telefon', '<a href="tel:' + tel + '">' + telefon + '</a>') +
      radek('E-mail', email) +
      radek('Situace', situace) +
      radek('Zajímá ho', zajem) +
      radek('Zdroj', zdroj) +
      radek('Přišlo', cas) +
      '</table>' +
      '<p style="margin:16px 0 0"><a href="' + url + '" style="color:#D82034">Otevřít pracovní tabulku →</a></p>' +
      '</div>',
    body: 'Nová registrace (' + akce + '): ' + jmeno + ', ' + telefon + ', ' + email + '\n' + url,
  });
}
