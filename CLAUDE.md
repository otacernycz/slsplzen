# Swiss Life Select Plzeň – Lochotínská

Tohle je marketingový projekt pobočky Swiss Life Select (SLS) Plzeň – Lochotínská. Marketing řídí Ota Černý (externí marketingový manažer). Pracuje se tu na e-mailových šablonách, landing pages, kampaních, grafice a dalších marketingových výstupech.

Komunikuj s Otou česky, neformálně a stručně. Oslovuj ho „borče", „šéfe" nebo „kámo".

---

## Značka

- **Swiss Life Select** – nezávislé finanční poradenství se zázemím švýcarské skupiny Swiss Life (165 let historie, rating A+)
- **Služby:** pojištění, investice, hypotéky, úvěry, finanční plánování, wealth management, DIP, renta, reality
- **Klientské nástroje:** aplikace FiLiP (všechny smlouvy v jedné aplikaci), FinData, iFin
- **Diferenciace:** nezávislost (celý trh, ne jedna banka), premium kvalita, osobní přístup, švýcarské zázemí
- **Claim:** „Pomáháme vám žít podle vlastních představ. Vy budujete kariéru, my budujeme vaši rentu."
- **Sítě:** @slsplzen (FB, IG, LinkedIn)

**Nejsme** low-cost, mass market ani agresivní prodejci. Konkurenci nikdy nekritizujeme přímo.

## Tón

Exkluzivní, edukativní, lidský („my", „náš tým v Plzni"), profesionální, ale přátelský. Krátké věty. Emoji s mírou.

**Zakázáno:** „AKCE! SLEVA! NEVÁHEJTE!", ZDARMA verzálkami, hromady vykřičníků, korporátní fráze, zbytečné anglicismy (zavedené termíny jako DIP, wealth management, CTA jsou OK).

## Cílovka – persona „Hans"

35–45 let, ženatý, 2 děti, manažer nebo úspěšný OSVČ, příjem domácnosti 80–100 tis. Kč/měsíc. Zodpovědný, ale nemá čas. Chce aktivní rentu a zabezpečit rodinu.

Trápí ho: pocit „křečka v kole", strach z výpadku příjmu, chaos ve smlouvách, nemovitosti, předání majetku dětem.

Vybere si nás kvůli: pohodlí (vše na jednom místě), vedení, bezpečí, VIP péči.

## Vizuální identita (CI)

- **Písmo:** ITC Legacy Sans (Book, Bold); fallback Arial
- **Barvy:** červená `#D82034`, černá `#000000`, bílá `#FFFFFF`, šedá `#808080`
- Nadpisy na titulkách jen bílé, černé nebo šedé
- Vizuály světlé a pozitivní, ne temné. Lidé na obrázcích mají působit jako místní, plzeňští.

## Compliance

- Reklama na spotřebitelské úvěry s úrokovou sazbou musí mít **reprezentativní příklad a RPSN**
- Konkrétní partnerské pojišťovny a produkty nejmenovat, pokud to Ota nezadá
- Čísla a statistiky nevymýšlet – jen ta, která Ota dodá nebo která jsou ověřená
- Edukativní obsah (sazby ČNB, DIP, daně) ověřovat na aktuálnost

## Klíčové projekty a nástroje

- **Investiční minikurz** (investicniminikurz.cz) – bezplatný pětidílný e-mailový kurz o investování do nemovitostí; leady jdou do Ecomailu
- **Meta Ads** – lead kampaně s geografií omezenou na Plzeň a okolí
- **Grafika:** Krea.ai s vlastní SLS LoRA, finální sazba v Affinity Designer
- **Obsahový kalendář:** Google Sheets

## Cíle (KPIs)

- 35 kvalifikovaných leadů měsíčně
- 7 nových schůzek měsíčně z online marketingu
- Dosah 15–25 tis. lidí v Plzeňském kraji měsíčně
- 2–3 kandidáti na kariérní pohovor měsíčně

## Jak pracovat

1. **Drž scope** – dělej, o co Ota žádá. Nápady navíc nabídni jednou větou.
2. **Rozhoduj sám** – když něco není jasné, zvol rozumnou variantu a napiš, co jsi zvolil. Ptej se jen u věcí, kde by špatný odhad stál hodně práce.
3. **Otovy texty** – když pošle vlastní text, dělej cílené úpravy, ne přepis.
4. **Upozorni na problém** – rozpor s brandem, chybějící RPSN, slabé CTA. Radši hned.
5. **E-maily a stránky** – mysli na mobil, čitelnost a jedno jasné CTA.

## Tohle repo

- `templates/` – HTML e-mailové šablony minikurzu (úvod + díly 1–5) a šablony k akcím (`templates/akce/`)
- `web/` – web investicniminikurz.cz (landing page, `dekujeme.html`, `subscribe.php` napojené na Ecomail, infografiky, stránky akcí)
- **Pozor:** každý push do `main`, který mění něco ve `web/`, se automaticky nasadí na Wedos (GitHub Actions → FTP). Změny ve `web/` tedy jdou rovnou naživo.
- `web/ecomail-config.php` obsahuje přístupy, je v `.gitignore` – nikdy ho necommitovat (vzor je v `ecomail-config.example.php`)
