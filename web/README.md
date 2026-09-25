# investicniminikurz.cz

Statický web (+ jeden PHP endpoint) pro pětidenní e-mailový minikurz o
investování do nemovitostí. Hostováno na Wedosu, nahráváno přes FTP.

## Struktura

- `index.html` — vlastní landing page
- `subscribe.php` — zpracuje formulář a přihlásí kontakt do Ecomailu
- `ecomail-config.example.php` — vzor konfigurace; zkopírovat na serveru
  do `ecomail-config.php` a doplnit reálný API klíč
- `assets/`, `fonts/`, `infografiky/` — statická media
- `nemovitosti_10_2026/` — registrační stránka na akci „Od nájmu k výnosu"
  (13. 10. 2026): `index.html` (dotazník), `dekujeme.html`, `registrace.php`

## Registrační stránky na akce

Každá akce má vlastní složku (`/<tema>_<mesic>_<rok>/`). Pro další akci
zkopírujte složku, přejmenujte ji a upravte texty, `EVENT_ID` v `index.html`
a `dekujeme.html`.

`registrace.php` čte `../ecomail-config.php` a přihlašuje kontakty do
stávajícího seznamu `ECOMAIL_LIST_ID` (případně do `ECOMAIL_EVENT_LIST_ID`,
pokud je vyplněný). Minikurzové automatizace se nespouští. Kontakt dostane
štítek akce (`nemovitosti-10-2026`) a vyplní se vlastní pole `AKCE`,
`AKCE_VZTAH`, `AKCE_ZAJMY` a `AKCE_ZDROJ` — ta musí v seznamu v Ecomailu existovat.

Měření (GTM `GTM-MW3Z5PJH`) — události jsou obecné, liší se parametrem
`event_id`, takže v GTM stačí jeden trigger pro všechny budoucí akce:
- `event_registrace` — úspěšné odeslání formuláře
- `event_registrace_dekujeme` — načtení děkovací stránky

## Nasazení

Obsah téhle složky (`web/`) se 1:1 nahrává do webrootu na Wedosu.
`ecomail-config.php` se do gitu nikdy nedává (viz `.gitignore`) —
na serveru musí zůstat s reálným klíčem, lokálně/v repu je jen vzorový
soubor.
