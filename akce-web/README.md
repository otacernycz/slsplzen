# Akce – Swiss Life Select Plzeň (Lochotínská)

Microsite s akcemi: pozvánky na nadcházející akce + fotogalerie z proběhlých.
Statický web bez buildu a bez PHP. Vizuál převzatý z investicniminikurz.cz a
`kariera-web/` – stejné CSS proměnné a názvy tříd.

## Struktura

```
index.html                 rozcestník – nadcházející akce, proběhlé akce, sítě, kdo pořádá
nemovitosti-10-2026.html   detail proběhlé akce s fotogalerií (vzor pro další)
assets/style.css           sdílené styly
assets/galerie.js          lightbox: klik na fotku, šipky / swipe, Esc
assets/img/                ilustrace a obálky akcí
assets/event_DD_MM/        fotky z akce (export pro sítě 1080×1350), náhledy v nahled/
```

## Nová pozvánka

1. Registrační stránku udělat podle `templates/akce/` (formulář + `registrace.php`).
2. V `index.html` v sekci `#nadchazejici` zkopírovat blok `<a class="event">`,
   doplnit datum, název, větu, čas, místo, kapacitu a `href` na registraci.
   Nejbližší akce nahoru.
3. Když žádná akce není v plánu, smazat `.events` a odkomentovat `.empty`.

## Po akci – fotogalerie

1. Fotky do `assets/event_DD_MM/` (stačí exporty pro sítě 1080×1350) a vyrobit
   náhledy, ať galerie nenačítá desítky MB:
   `cd assets/event_DD_MM && mkdir -p nahled && for f in *.jpg; do sips -Z 700 -s formatOptions 78 "$f" --out "nahled/$f"; done`
2. Zkopírovat `nemovitosti-10-2026.html` pod novým jménem, upravit `<title>`,
   `description`, `og:*`, `data-event-id` na `<body>`, hero, program a galerii.
3. V `index.html` přesunout akci z `#nadchazejici` do `#probehle` jako
   `.past-card` (nejnovější nahoru).

## Co zbývá

1. **OG obrázek** `assets/img/og-image.jpg` (1200×630) a absolutní URL v `og:*`
   a `canonical`, až bude jasná doména.
2. **Měření** – GTM `GTM-MW3Z5PJH` + cookie lišta jako na minikurzu.
   `galerie.js` už posílá `akce_galerie_foto` do `dataLayer`, pokud existuje.
3. **Patička** – adresa kanceláře, odkaz na zásady ochrany osobních údajů.
4. **Nasazení** – vlastní doména, workflow `.github/workflows/deploy-akce.yml`.
   Po pushi do `main` se změny v `akce-web/` nahrají přes FTP (stejné secrets
   `WEDOS_FTP_*` jako minikurz). Ruční kroky:

   a) Na Wedosu přidat doménu k hostingu (doplňková doména). Wedos jí založí
      složku, typicky `www/domains/<domena>/`.

   b) V GitHubu: Settings › Secrets and variables › Actions › **Variables** ›
      `AKCE_SERVER_DIR` = `./www/domains/<domena>/` (s lomítkem na konci).
      Bez ní workflow skončí chybou, místo aby nahrál web do špatné složky.

   c) Pokud doména běží na jiném FTP účtu než minikurz, přidat vlastní secrets
      a přepsat je ve workflow.

   d) Až bude doména jasná: absolutní URL v `og:image`, doplnit `canonical`,
      `og:url`, `sitemap.xml` a `robots.txt`.
5. **Před spuštěním** – web se značkou SLS potřebuje schválení marketingu
   Swiss Life Select.
