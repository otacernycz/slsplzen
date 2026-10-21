# Šablona registrační stránky na akci

Kopie stránky akce „Od nájmu k výnosu“ (13. 10. 2026) ve stavu, v jakém běžela
registrace. Živá složka `web/nemovitosti_10_2026/` je po akci přepnutá na
stránku „proběhlo“ (`probehlo.html` níže), takže tahle složka je jediné místo,
kde je plná registrace uložená.

## Soubory

- `index.html` — landing page s třístupňovým dotazníkem (hero, program, jak to
  funguje, formulář, kdo pořádá). Odesílá na `registrace.php`.
- `dekujeme.html` — děkovací stránka po odeslání.
- `registrace.php` — endpoint: lead jde do Google tabulky (Apps Script webhook),
  Ecomail je záloha. Čte `../ecomail-config.php` na serveru.
- `probehlo.html` — stránka po akci: poděkování, odkazy na sítě (Instagram,
  Facebook, LinkedIn), CTA na bezplatný minikurz. Nasadí se místo `index.html`,
  když je registrace uzavřená.
- `assets/` — obrázky (ilustrace Hanse, OG obrázek). Pro novou akci vyměnit
  aspoň `og-image.jpg`.

## Nová akce — postup

1. Zkopírovat tuhle složku do `web/<tema>_<mesic>_<rok>/` (bez `README.md`
   a `probehlo.html`).
2. V `index.html` upravit: `<title>`, `description`, `canonical`, `og:*`,
   JSON-LD (`name`, `startDate`), hero (název, datum, místo), program (4 témata),
   otázky v dotazníku (`data-value` hodnoty jdou do štítků v Ecomailu),
   partnery v sekci „Kdo pořádá“ a `EVENT_ID` ve skriptu dole.
3. V `dekujeme.html` upravit `<title>`, `canonical` a `event_id` v `dataLayer`.
4. `registrace.php` neměnit — štítek akce se odvodí z `EVENT_ID`, které posílá
   formulář.
5. Měření: GTM (`GTM-MW3Z5PJH`) má jeden trigger na `event_registrace` /
   `event_registrace_dekujeme`, rozlišené parametrem `event_id`. Nic dalšího
   nastavovat nemusíte.
6. Po pushi do `main` se `web/` nahraje na Wedos přes GitHub Actions.

## Po akci

1. `probehlo.html` zkopírovat do složky akce jako `index.html`, upravit datum,
   název a `EVENT_ID`.
2. Smazat `dekujeme.html` a `registrace.php` ze složky akce (ať na serveru
   nezůstane otevřený endpoint). Assets nechat — stránka je používá.
3. Měření: stránka posílá `event_probehlo` při načtení, `event_probehlo_social`
   při prokliku na síť a `event_probehlo_minikurz` při prokliku na minikurz.
