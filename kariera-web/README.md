# Kariéra – Swiss Life Select Plzeň (Lochotínská)

Náborový microsite: rozcestník pozic + detail pozice Manažer (kampaň s Pavlem Ciglerem).
Statický web bez buildu. Vizuál převzatý z investicniminikurz.cz – stejné CSS proměnné a názvy tříd.

## Struktura

```
index.html        rozcestník – seznam pozic, obecný formulář („Ještě nevím“)
manazer.html      detail pozice Manažer – sem míří Meta reklamy
assets/style.css  sdílené styly
assets/form.js    chipy, validace, odeslání na lead.php
lead.php          endpoint: lead → Google tabulka (Apps Script), záloha Ecomail
kariera-config.example.php  vzor konfigurace (na serveru jako kariera-config.php)
```

Další pozice (koncipient, asistent prodeje): zkopírovat `manazer.html`, upravit texty
a `data-source` na formuláři, v `index.html` přepnout odkaz z `#kontakt` na nový soubor.

## Lokální stage

Web s funkčním formulářem a falešnou tabulkou místo Apps Scriptu:

```bash
dev/kariera-stage/stage.sh
```

(z kořene repa, nebo v aplikaci jako preview `kariera-stage`)

- web: http://127.0.0.1:8096/ – leady jdou přes skutečný `lead.php`
- tabulka: http://127.0.0.1:8097/ – přijaté leady (data v `dev/kariera-stage/leady.csv`)
- výpadek tabulky: `touch dev/kariera-stage/FAIL`, zpět `rm dev/kariera-stage/FAIL`

Skript při prvním spuštění založí `kariera-web/kariera-config.php` se stage hodnotami
(gitignored). Na server ho nenahrávat – tam patří skutečný config.

## Co zbývá

1. **Formulář → Google Sheet.** Formulář posílá na `lead.php`, ten lead zapíše
   do náborové tabulky přes Apps Script a teprve podle odpovědi ukáže „Děkujeme“.
   Když tabulka selže, zkusí zálohu do Ecomailu (jen s e-mailem, štítek `kariera`).
   Ruční kroky:

   a) V Google tabulce list `Leady` s hlavičkou
      `cas, stranka, pozice, jmeno, telefon, email, zprava, souhlas, utm_source, utm_medium, utm_campaign, utm_content, utm_term`.

   b) Rozšíření › Apps Script, vložit skript, doplnit `WEB_TOKEN` (libovolný dlouhý
      náhodný řetězec) a `NOTIFY` (kdo dostane e-mail o novém leadu).
      Nasadit › Nové nasazení › Webová aplikace, spouštět jako „Já“, přístup „Kdokoli“.

   ```js
   const WEB_TOKEN = 'DOPLNIT';
   const NOTIFY = 'DOPLNIT@example.cz';
   const COLS = ['cas','stranka','pozice','jmeno','telefon','email','zprava','souhlas',
                 'utm_source','utm_medium','utm_campaign','utm_content','utm_term'];

   function doPost(e) {
     const out = o => ContentService.createTextOutput(JSON.stringify(o))
       .setMimeType(ContentService.MimeType.JSON);
     let d;
     try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
     if (d.token !== WEB_TOKEN) return out({ ok: false, error: 'bad token' });

     SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leady')
       .appendRow(COLS.map(k => d[k] || ''));

     MailApp.sendEmail(NOTIFY, 'Nový náborový lead: ' + d.jmeno + ' (' + d.pozice + ')',
       COLS.filter(k => d[k]).map(k => k + ': ' + d[k]).join('\n'));
     return out({ ok: true });
   }
   ```

   c) Na serveru vedle `lead.php` vytvořit `kariera-config.php` podle
      `kariera-config.example.php` (URL nasazení + stejný token). Do gitu nepatří.

2. **Obrázky a logo** – nahradit prvky `.ph` (placeholdery):
   - logo `swisslife-select.svg` (stejné jako minikurz) – hlavička + patička
   - `index.html` hero: ilustrace v SLS stylu (Krea LoRA)
   - `manazer.html` hero: fotka Pavla Ciglera
   - OG obrázky `assets/img/og-image.jpg`, `assets/img/og-manazer.jpg` (1200×630)
   - po doplnění smazat třídu `.ph` ze `style.css`

3. **Texty v [HRANATÝCH ZÁVORKÁCH]** – adresa, telefon, e-mail, pozice lidí,
   citát Pavla, doba odezvy [X] dnů, odstavec o kanceláři.

4. **GDPR** – odkaz na zásady ochrany osobních údajů (formulář i patička);
   souhlas zahrnuje i uchování kontaktu pro budoucí nabídky.

5. **Měření** – Meta Pixel (form.js už volá `fbq('track','Lead')`, pokud pixel existuje),
   cookie lišta jako na minikurzu.

6. **Před spuštěním** – vlastní web se značkou SLS potřebuje předem schválení
   marketingu Swiss Life Select (výjimka pro nábor dle „Komunikace v digitálních médiích“).

## Pozor na fakta

Všechna tvrzení jsou z oficiálních materiálů SLS (náborová brožura, nabídka spolupráce
pro manažery). Nabídka pro manažery je označená DŮVĚRNÉ – proto na webu nejsou konkrétní
částky (VIP startovné, ukázkové výdělky). Nepřidávat bez souhlasu.
