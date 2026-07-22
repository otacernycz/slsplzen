# investicniminikurz.cz

Statický web (+ jeden PHP endpoint) pro pětidenní e-mailový minikurz o
investování do nemovitostí. Hostováno na Wedosu, nahráváno přes FTP.

## Struktura

- `index.html` — vlastní landing page
- `subscribe.php` — zpracuje formulář a přihlásí kontakt do Ecomailu
- `ecomail-config.example.php` — vzor konfigurace; zkopírovat na serveru
  do `ecomail-config.php` a doplnit reálný API klíč
- `assets/`, `fonts/`, `infografiky/` — statická media

## Nasazení

Obsah téhle složky (`web/`) se 1:1 nahrává do webrootu na Wedosu.
`ecomail-config.php` se do gitu nikdy nedává (viz `.gitignore`) —
na serveru musí zůstat s reálným klíčem, lokálně/v repu je jen vzorový
soubor.
