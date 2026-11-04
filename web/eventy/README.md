# Eventy – Swiss Life Select Plzeň (Lochotínská)

Podstránka **investicniminikurz.cz/eventy/**: pozvánky na nadcházející akce
a fotogalerie z proběhlých. Statické HTML bez buildu. Nasazuje se s celým
`web/` po pushi do `main` (GitHub Actions → FTP na Wedos).

## Struktura

```
index.html                 rozcestník – nadcházející akce, proběhlé akce, sítě, kdo pořádá
nemovitosti-10-2026.html   detail proběhlé akce: program, partneři, fotogalerie (vzor pro další)
assets/style.css           styly
assets/galerie.js          lightbox: klik na fotku, šipky / swipe, Esc
assets/cookies.js          cookie lišta (sdílená volba s hlavní stránkou) + měření prokliků
assets/img/                ilustrace a OG obrázky (1200×630)
assets/partneri/           loga partnerů
assets/event_DD_MM/        fotky z akce (export pro sítě 1080×1350), náhledy v nahled/
```

## Nová pozvánka

1. Registrační stránku udělat podle `templates/akce/` do `web/<tema>_<mesic>_<rok>/`.
2. V `index.html` v sekci `#nadchazejici` zkopírovat blok `<a class="event">`,
   doplnit datum, název, větu, místo, `href="/<slozka-akce>/?utm_source=eventy"`
   a `data-event-id` (stejné jako `EVENT_ID` registrace). Nejbližší akce nahoru.
3. Když žádná akce není v plánu, smazat `.events` a odkomentovat `.empty`.

## Po akci – fotogalerie

1. Fotky do `assets/event_DD_MM/` a vyrobit náhledy, ať galerie nenačítá desítky MB:
   `cd assets/event_DD_MM && mkdir -p nahled && for f in *.jpg; do sips -Z 700 -s formatOptions 78 "$f" --out "nahled/$f"; done`
2. Zkopírovat `nemovitosti-10-2026.html` pod novým jménem, upravit `<title>`,
   `description`, `canonical`, `og:*`, `data-event-id` na `<body>`, hero,
   program, partnery a galerii. OG obrázek: výřez fotky 1200×630.
3. V `index.html` přesunout akci z `#nadchazejici` do `#probehle` jako
   `.past-card` (nejnovější nahoru). Přidat stránku do `../sitemap.xml`.

## Měření (GTM `GTM-MW3Z5PJH`)

- `eventy_registrace_klik` (`event_id`) – proklik z pozvánky na registraci
- `akce_galerie_foto` (`event_id`) – otevření fotky v galerii
- Proklik z eventů je v leadech vidět jako `utm_source=eventy` (štítek `zdroj-eventy`).

## Před spuštěním další akce

Web se značkou SLS a loga partnerů patří pod schválení marketingu Swiss Life Select.
