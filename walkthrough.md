# Walkthrough

## 2026-11-26 (Productcatalogus en scanner)

- Findings: de DARF-sitemap noemt **340 productpagina's**, terwijl de import via vijftien
  categoriepagina's maar 130 producten ophaalde; de rest (ALRODA Bio, MEAT4DOGS, PETT,
  Felichef, snacks) kwam nooit in de app. `robots.txt` van darf.nl staat alles toe.
  De sitemap bevat ook verouderde slugs (2 van de eerste 50 geven 404) en korte slugs die
  met een 301 doorverwijzen naar de volledige productpagina (`alroda-geit` →
  `alroda-puur-bio-geit`) — zonder afhandeling levert dat dubbele producten op.
- Conclusions: een catalogus met historie in plaats van een snapshot-bestand. Dezelfde
  scanner kan later NEVO/USDA als dataset inlezen; die bronnen staan al in `catalog_sources`.
  Wijzigingen in calcium/fosfor/energie worden automatisch overgenomen tot 10% afwijking en
  daarboven ter goedkeuring gezet (`--list-pending`, `--approve`, `--reject`).
- Actions:
  - `db/catalog.sql` — catalogusschema, gedeeld door app en scanner (één bron van waarheid;
    de scanner is een los Node-proces en kan de TypeScript niet importeren).
  - `scripts/lib/darf-parse.mjs` — DARF-pagina's lezen met **cheerio** in plaats van regex,
    plus de afleidingen (deel, heel dier, merk, gewicht, energieraming).
  - `scripts/catalog-scan.mjs` — sitemap-ontdekking, robots-controle, 1,5 s tussen verzoeken,
    retries, hash-diff per product, veldwijzigingen in `catalog_changes`, runs in
    `catalog_runs`, aliassen voor het zoekveld, en `--import-snapshot` voor de bestaande 130.
  - `src/lib/catalog.ts` + `GET /api/catalog/search?q=` — zoeken op naam, merk en alias.
  - `src/lib/db.ts` — `ensureCatalogSchema()` bij het openen van de database en `database()`
    als toegang voor modules die zelf geen verbinding openen.
- Gecontroleerd: parser herschreven en vergeleken met de bestaande snapshot op twaalf
  producten over alle merken en delen — 9 identiek, 3 verklaarbaar beter (volledige
  ingrediëntentekst waar de oude regex bij de eerste `</div>` afkapte; twee gewichten die
  alleen op de categoriekaart staan en niet op de detailpagina). Snapshot-import: 130
  producten, tweede run 130× "gelijk" (idempotent). Proefrun van 5 pagina's: 3 nieuwe
  ALRODA Bio-producten, 2 verouderde sitemap-slugs netjes als "niet gevonden". Wijzigingen
  getest: 42% afwijking → blijft staan als `wacht` en verschijnt in `--list-pending`;
  goedkeuren schrijft de waarde én houdt `analysis_json` gelijk; 4,3% afwijking wordt
  automatisch overgenomen.
## 2026-11-26 (Smaakvoorkeur vult aan, vervangt niet)

- Findings: in `shoppingListFor()` stond `const meatChoices = preferred.length > 0 ? preferred :
  defaultMeatChoices(...)`. Eén aangevinkte smaak verving dus de standaardmix: een advies met
  "kip" leverde 6 regels in plaats van 18, met karkas, orgaan, spier én bot allemaal kip. Dat is
  niet alleen saai, het legt het hele menu ook op kippebot — met de bijbehorende calcium- en
  fosforlast. Zonder likes waren het vier smaken (kip, rund, lam, eend) en 18 regels.
- Conclusions: voorkeur = basis + aanvulling tot vier smaken, met 40% van elk deel voor de
  voorkeurssmaak. In de picklijst matchte een voorkeur alleen de exacte smaakwaarde (`KIP` viel
  niet op `KIP.HART`), dus daar ook op het smaakdeel matchen en het aandeel aftoppen.
- Actions:
  - `src/lib/shopping.ts` — `meatChoicesFor()` (voorkeur vooraan, aanvullen tot `MAX_MEAT_CHOICES`
    = 4), `splitGramsWeighted()` (gewicht 2 voor de voorkeur, 1 voor de rest),
    `wholeAnimalTotals()` gebruikt dezelfde verdeling zodat de heel-dierverpakkingen kloppen.
  - `src/lib/picklist.ts` — `isPreferredTaste()` matcht het smaakdeel; in `fill()` een tweede
    gewogen lijst met alleen niet-voorkeurssmaken, waaruit gekozen wordt zodra het aandeel de
    grens (`PREFERENCE_SHARE` = 0,4) raakt. Eén product mag de grens niet overschrijden: dan
    wordt het een andere smaak.
  - `src/lib/globals.ts` — `PREFERENCE_SHARE`.
- Gecontroleerd: boodschappenlijst hond 20 kg 100% — geen likes 18 regels/4×25%; likes KIP 18
  regels met kip 40% en rund/lam/eend 20%; likes KIP+RUND 33/33/17/17. Picklijst: KIP-voorkeur
  geeft 37% kip in het botdeel (was 100% kip bij een kip-only menu) met 5 smaken in dat deel;
  zes orders × tien seeds: gewicht 10/10 binnen tolerantie, geen waarschuwingen, 10–26 smaken per
  menu. `tsc --noEmit` en `next build` slagen.

## 2026-11-26 (Calcium stuurt de picklijst)

- Findings: de generator koos bot volledig op voorraad en smaakvariatie. Omdat bot (of gemalen
  vlees bij een PLUS-pakket) de restpost van het menu is, hing het calciumgehalte daarmee
  af van de vraag of er toevallig gevogeltekarkas in de lijst zat. Over 30 seeds per order
  kwam een pup van 8 kg in 18 van de 30 gevallen boven de puppennorm van 0,48 g per 100 g uit;
  bij de volwassen honden en de kat viel geen enkel menu buiten de band.
- Conclusions: sturen op het midden van de band (of 1,5× de ondergrens waar de norm geen
  bovengrens noemt, zoals bij katten) via drie lagen — wegingsfactor op het restdeel, een
  calciumterm in `chooseBest` en een reparatiestap die botregels verwisselt met ander bot uit
  de voorraad. Wat niet te repareren valt wordt gemeld, niet verzwegen. De sturing staat
  standaard aan en is met `{ steerCalcium: false }` uit te zetten.
- Actions:
  - `src/lib/picklist.ts` — `targetCalciumPer100g()`, `calciumFit()`,
    `selectionCalciumDeviation()`, `calciumPer100gFor()`, `requiredCalciumForRemainder()`,
    `repairCalcium()`; `collect()`, `selectType()`, `makeList()` en `chooseBest()` kennen nu
    een calciumdoel voor het restdeel; `OrderInput.pup` bepaalt de band.
  - `src/lib/db.ts` geeft `pup` mee aan de generator.
  - Valkuil die hier boven kwam: `calciumPer100gFor()` gebruikte eerst alleen de terugval per
    vleestype, waardoor een menu met eigen analyses alsnog op de terugval werd beoordeeld en de
    reparatie niets deed. Nu telt het calcium van het product zelf mee.
- Gecontroleerd (30 seeds per order, echte voorraad): pup 8 kg 18/30 buiten de band zonder
  sturing → **0/30 met sturing** (0,43–0,48 g/100 g); hond 20 kg 0,45–0,47; kat 0/30. Met
  synthetische analyses van 0,05% calcium slaat de melding aan met "Calcium te laag: 0,07 g per
  100 g voer (norm 0,17 – 0,75 g voor volwassen hond)" en bij 2,5% met "te hoog"; de reparatie
  bracht 2,5%-gevallen van 1,366 naar 1,251 g/100 g. `tsc --noEmit` en `next build` slagen.

## 2026-11-26 (Calcium en fosfor in de berekening)

- Findings: er zat nergens een mineraalwaarde in de app, terwijl calcium de maat is waarop
  een rauw menu wel of niet klopt. Het botpercentage is daar geen bruikbare vervanging voor:
  in de DARF-snapshot loopt calcium bij losse botproducten uiteen van 0,13% (lamsbot) tot
  0,39% (kipnekken) en bij karkassen tot 1,30%. De DARF-analyse bevat wél calcium en fosfor
  (130 van 130 producten), maar geen energie: 118 producten hebben calcium zonder kcal, dus
  een omrekening per 1000 kcal kan nog niet voor alle regels. De eigen voorraad (346 SKU's)
  had geen enkele analyse.
- Conclusions: calcium en fosfor per product vastleggen in g per 100 g product, met een
  terugval per vleestype zodat geen enkele regel stil op nul valt, en de uitkomst toetsen aan
  de FEDIAF-band per dier (hond volwassen, pup, kat, kitten). FEDIAF geeft de normen per
  100 g droge stof en per 1000 kcal; rauw voer is ~30% droge stof, dus de band is omgerekend
  naar g per 100 g voer. Alleen rapporteren, nog niet sturen in de generator: het menu
  verandert niet, de cijfers komen erbij.
- Actions:
  - `src/lib/minerals.ts` — banden (`MINERAL_BANDS` met de FEDIAF-bron per dier), terugval
    per vleestype (`FALLBACK_MINERALS`) en per adviesdeel (`PART_MINERALS`), `productMinerals()`,
    en `summariseMinerals()` dat grammen × gehalte optelt tot g calcium, g fosfor, de
    Ca:P-verhouding en een oordeel (`laag`/`ok`/`hoog`/`onbekend`).
  - `src/lib/db.ts` — kolommen `products.calcium` en `products.fosfor` (additief, via
    `addColumnIfMissing`), seeding van eigen analyses uit `data/product-nutrition.csv`
    (blijft staan bij een herimport van `test/products.csv`).
  - `src/lib/types.ts`, `src/lib/picklist.ts`, `src/lib/darf.ts`, `src/lib/advice.ts`,
    `src/lib/shopping.ts` — mineralen per product, per picklijstregel en per adviesdeel.
  - `src/app/(public)/advies/[id]/page.tsx` — sectie "Mineralen" met calcium per 100 g voer,
    per dag en de Ca:P-verhouding, calcium per samenstellingsdeel, en per boodschappenregel.
  - `src/app/(beheer)/beheer/orders/[id]/page.tsx` — kolom `Ca` per regel en een tegel met
    calcium per 100 g plus het oordeel; `export/route.ts` — kolommen `calcium_pct`,
    `fosfor_pct` en samenvattingsregels in de CSV.
  - `src/components/advice-wizard.tsx` — calcium per dag en het oordeel in het adviespaneel.
  - Gecontroleerd met de echte DARF-snapshot en de eigen voorraad: hond 20 kg (100%-menu)
    komt op 0,47 g calcium per 100 g voer (binnen de norm), puppy 8 kg op 0,46 g maar de
    boodschappenlijst uit op 0,49 g (boven de puppennorm van 0,30 – 0,48), kat 4 kg op
    0,64 g (minimaal 0,16). `tsc --noEmit` en `next build` slagen; adviespagina's en de
    CSV-export zijn via de draaiende app opgehaald en gecontroleerd.
- Open: energiewaarden ontbreken bij 118 DARF-producten, dus `calcium_g_per_1000_kcal` staat
  in de CSV op "onbekend". De DARF-detailpagina's publiceren de analyse (vocht, ruw eiwit,
  ruw vet, vezels, ruwe as) maar geen kcal; die zijn opnieuw te scrapen en dan met de
  Atwater-factoren te schatten, te ijken op de 12 producten die al een energiewaarde hebben.

## 2026-11-26 (Energiewaarden en de analyse gelijktrekken)

- Findings: de aanname dat de DARF-pagina's geen energie publiceren was fout — het zijn de
  labels die verschillen. De analyse-rijen komen binnen onder ~20 spellingen ("Energie",
  "Energie (kcal 100g)", "Energie Kcal / 100g", "Energie KCal / 100g", "Energie/ kcal 100g",
  "Energie Kcal", "Energie Kcal per 100g", "energie (Kcal)", …) en idem voor eiwit, vet,
  vezels/celstof en as, met typefouten als "Clacium", "Ruwe celsof" en "Ruwe eitwit". Daardoor
  stond in de snapshot 1 product met een leesbare energiewaarde terwijl er in werkelijkheid
  120 zijn.
- Conclusions: labels gelijktrekken naar één canonieke set met getallen, en alleen waar de
  fabrikant niets publiceert de energie teruggerekend invullen met de gemodificeerde
  Atwater-factoren (4/9/4) — gemarkeerd als `schatting`, nooit als opgave. Geijkt op de 97
  producten waar beide bekend zijn: gemiddeld 7,4% afwijking (EU-factoren 3,5/8,5/3,5: 11,4%).
  Lamsbot blijft zonder energie: de analyse op de pagina telt op tot 103%, dus een schatting
  zou daar verzonnen zijn.
- Actions:
  - `scripts/import-darf.mjs` — `normaliseAnalysis()`, `analysisValue()`,
    `canonicalAnalysisKey()`, `estimateEnergy()` en `applyEnergy()`; `--normalise-only` werkt
    de bestaande snapshot bij zonder netwerk.
  - `data/darf-products.json` — 130 producten genormaliseerd: energie uit opgave 120, geschat
    3, onbekend 7; `energieBron` per product.
  - `src/lib/darf.ts` — analyse getypeerd op canonieke sleutels, `energieBron` doorgegeven.
  - `src/lib/minerals.ts` — energie per deel en per vleestype, `energiePer100g` en
    `energieBron` in het rapport; `data/product-nutrition.csv` kreeg een optionele
    `energie`-kolom, `products.energie` volgt dezelfde additieve migratie.
  - Advies, beheertegel en CSV tonen nu ook `g calcium per 1000 kcal` met de herkomst van de
    energie erbij.
  - Gecontroleerd: hond 20 kg → 2,65 g Ca/1000 kcal (172,6 kcal/100 g, opgave); picklijst →
    2,62 g/1000 kcal; boodschappenlijst → 3,48 g/1000 kcal, gemarkeerd als schatting omdat
    kipnekken (107 kcal) teruggerekend is. `tsc --noEmit` en `next build` slagen.

## 2026-11-25 (Repo omgezet naar webapp)

- Findings: de repo bevatte een Python 2 / GTK-desktopwizard (`oervoer/`, `gtk/`) plus een
  onaffe Django 1.8-port (`oervoer-django/`). Beide draaien niet meer op een moderne
  omgeving. De kern is waardevol: de picklist-generator met vaste pakketverhoudingen,
  gewogen willekeur en dieetrestricties.
- Conclusions: gekozen voor één zelfstandige Next.js 16-app (TypeScript, Tailwind 4,
  SQLite via `node:sqlite`) in de root, met de oude mappen onaangeroerd als archief.
  Daarmee is er geen Python- of native dependency nodig en blijft de app lokaal én op een
  VPS eenvoudig te draaien. De generator is trouw geport; alleen bewezen fouten zijn
  rechtgezet (eenheden van `SMALLMEAL`/`BIGMEAL` naar kg, maaltijdgrootte niet afgerond op
  0,1 kg, en `in_stock` niet als voorwaarde omdat de bron dit veld onbetrouwbaar vult).
- Actions:
  - `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` toegevoegd;
    dependencies: next 16.4.6, react 19.3.1, tailwindcss 4.3.5, lucide-react.
  - `src/lib/globals.ts` — constanten uit `oervoer/globals.py`.
  - `src/lib/picklist.ts` — port van `oervoer/oervoer.py`, `product.py`, `order.py` en
    `weighted_random.py`, met seeded RNG voor reproduceerbare picklijsten.
  - `src/lib/db.ts` — SQLite-schema (`products`, `orders`, `picklists`), seeding uit
    `test/products.csv` + zes voorbeeldorders, voorraad terugboeken bij opnieuw genereren
    en bij verwijderen.
  - `src/lib/csv.ts` — quote-bewuste CSV-parser en export.
  - `src/app/` — dashboard, orders (lijst, nieuw, detail, CSV-route), voorraad; server
    actions voor aanmaken, genereren, intrekken, afronden, verwijderen en voorraad.
  - `src/components/` — sidebar, status-/pakketbadges, orderformulier met live
    maaltijdpreview, actieknoppen met bevestiging.
  - `src/app/globals.css` — warme "slagerij"-stijl (bot, mosgroen, roest) en printregels.
  - `README.md` herschreven; `.gitignore` uitgebreid met Node/Next, `.data/` en
    Playwright-output.
  - End-to-end gecontroleerd in de browser: dashboard, orders, order aanmaken, picklijst
    genereren voor hond (PLUS), kat (100%) en hond (COMBI, grote porties, PENS vermijden),
    opnieuw genereren, CSV-export en printweergave. `tsc --noEmit` en `next build` slagen.
- Publicatie:
  - Nieuwe repo `https://github.com/Bojanni050/oervoer` (leeg, publiek) als `origin`
    ingesteld; oude fork blijft bereikbaar als `upstream`.
  - `lib/` en `lib64/` in `.gitignore` verankerd aan de root. Zonder die fix werden
    `src/lib/*.ts` als Python-buildartefact genegeerd en zou de app niet compileen na
    een fresh clone. Gecontroleerd dat alle lib-bestanden nu in de commit zitten.

## 2026-11-25 (Ombouw naar voedingsadvies-app)

- Findings: De app was een picklist-tool voor de slagerij. De wens is een publieke app waarin
  een bezoeker de gegevens van zijn dier invoert en een advies krijgt, waarbij de interne
  pakketten vertaald worden naar gewone taal (meer gemalen, meer karkas, van beide wat).
- Conclusions: De bestaande generator blijft nodig voor de picklijsten, dus die verhuist naar
  `/beheer` in een eigen route group. Het advies is een aparte, pure laag (`advice.ts`) die
  dezelfde verhoudingen gebruikt maar geen producten selecteert. Elk advies wordt opgeslagen
  zodat het een printbare, deelbare link krijgt. De openbare app en het beheer krijgen elk
  hun eigen layout; de rootlayout is weer kaal.
- Actions:
  - `src/app/(public)/` — nieuwe startpagina met hero, wizard, uitleg en stijlenkaarten;
    `advies/[id]` printbare uitslag met samenstellingsbalk, wensen, overgangsschema en
    waarschuwingen; publieke layout met header/footer; eigen not-found.
  - `src/app/(beheer)/beheer/` — dashboard, orders en voorraad verplaatst; eigen layout met
    sidebar en metadata. Alle interne links en revalidatiepaden naar `/beheer/...`.
  - `src/lib/advice.ts` — dagrantsoen (35/25 g per kg), maaltijden (2 of 3 bij pup/kitten),
    aanbevolen pakketgrootte, menu-opbouw met dezelfde recepten, vertaling van de stijlen,
    notities bij vermijden van vis/pens en waarschuwingen bij pup/kitten en zware katten.
  - `src/lib/types.ts`, `db.ts`, `actions.ts` — `advices`-tabel, `createAdvice`, `getAdvice`
    en `createAdviceAction`; id van 12 tekens.
  - `src/components/advice-wizard.tsx` — driegestappenformulier met live samenvatting.
  - `src/components/shell.tsx` — navigatie naar `/beheer`, link terug naar de adviesapp,
    `PawMark` geëxporteerd voor de publieke header.
  - Percentageafronding en grammen in `compositionFor` gecorrigeerd: eerst procenten
    afronden, totaal op 100 brengen en daar de grammen van afleiden. Zonder die volgorde
    verscheen `17.799999999999997%` in beeld.
  - README herschreven voor de nieuwe opzet.

## 2026-11-25 (Accounts, dieren en foto's)

- Findings: het advies was anoniem en een bezoeker kon een dier of eerder advies niet terugvinden.
  Er was behoefte aan een account met opgeslagen dieren (inclusief foto) en een adviesgeschiedenis.
- Conclusions: auth zonder externe dependency (scrypt + sessietokens waarvan alleen de hash in
  SQLite staat), foto's als BLOB in dezelfde database zodat er geen losse uploadmap ontstaat bij
  back-ups of deploys, en een optionele koppeling: anoniem advies blijft werken. De wizard vult
  zich vanuit een opgeslagen dier, maar een advies blijft een snapshot van de gegevens op dat
  moment.
- Actions:
  - `src/lib/auth.ts`, `src/lib/photo.ts` toegevoegd; `src/lib/db.ts` uitgebreid met `users`,
    `pets`, `sessions`, `photos`, migratie van `advices.user_id`/`pet_id` en alle queries.
  - `src/app/account-actions.ts` voor registreren, inloggen, uitloggen, profiel en dieren.
  - `src/app/(public)/inloggen`, `/registreren` en `/account` (inclusief dierformulieren);
    `src/app/foto/[id]/route.ts` voor foto's uit de database.
  - `src/components/photo-field.tsx`, `auth-forms.tsx`, `pet-form.tsx`, `profile-form.tsx`,
    `confirm-button.tsx`; publieke header toont avatar of inloglink.
  - `AdviceWizard` accepteert opgeslagen dieren en geeft het gekozen dier mee aan het advies.
  - Getest: registreren met foto, dier opslaan met foto, voorgevulde wizard, advies automatisch
    in het account, uitloggen/inloggen, data-isolatie tussen accounts en 404 bij een dier van
    een ander. `tsc --noEmit` en `next build` slagen.

## 2026-11-25 (Deploy op Plesk / Strato)

- Findings: De app moest naar `oer.studiovanderheide.nl` op de bestaande Plesk-server.
  Poort 3000 was bezet en Plesk gebruikt 80/443 (nginx), 7080/7081 (Apache) en 8443/8880
  (panel). Plesk-nginx bleek niet naar Apache te proxyen maar met `vhost_nginx.conf`
  rechtstreeks naar de Node-app, waardoor Basic auth in de Apache-vhost geen effect had.
- Conclusions: Node op 127.0.0.1:4310 achter de bestaande Plesk-nginx, als systemd-unit
  onder de subscription-user. Basic auth voor `/beheer` in nginx (`location ^~ /beheer`),
  met de Apache-Location als tweede laag. Geen extra webserver of poort naast Plesk.
- Actions:
  - Subdomein en Let's Encrypt-certificaat via Plesk aangemaakt; documentroot
    `/var/www/vhosts/studiovanderheide.nl/oer.studiovanderheide.nl`.
  - Repo gecloned naar `.../app`, gebouwd met Plesk Node 22. `npm ci --include=dev` en
    `runuser ... env -C` nodig omdat anders devDependencies en de werkmap ontbreken.
  - `/etc/systemd/system/oervoer.service` toegevoegd en geënabileerd.
  - Proxy's in `conf/vhost.conf`, `conf/vhost_ssl.conf` en `conf/vhost_nginx.conf`;
    Basic auth met `/root/oervoer-beheer.txt` en `conf/beheer.htpasswd`. Na elke wijziging
    `plesk repair web oer.studiovanderheide.nl -y`.
  - Gecontroleerd: homepage en inloggen 200; `/beheer`, `/beheer/orders` en
    `/beheer/voorraad` 401 zonder en 200 met auth; registreren en inloggen over HTTPS werken.
  - README voorzien van deploy-, update- en backupprocedure.

## 2026-11-25 (Dagelijkse databasebackup)

- Findings: De SQLite-database draait in WAL-modus; een gewone `cp` kan een incomplete of
  inconsistente kopie opleveren. Er was alleen een handmatige `.backup`-instructie.
- Conclusions: Een root-script met `sqlite3 .backup` plus `PRAGMA integrity_check` vóór
  rotatie. Dagelijks om 03:15, 14 dagen bewaren. Zo kan een corrupte kopie nooit de goede
  backups verdringen.
- Actions: `/usr/local/sbin/oervoer-backup.sh` en `/etc/cron.d/oervoer-backup` op de server;
  backups in `/root/backups/oervoer-YYYY-MM-DD.db` met log in `/var/log/oervoer-backup.log`.
  README-sectie Backup bijgewerkt. Handmatige testrun geslaagd (143.360 bytes, integrity ok).

## 2026-11-25 (Inloggen voor beheer)

- Findings: `/beheer` was op de server afgeschermd met HTTP Basic auth. Dat gaf een
  browserpopup in plaats van een normaal inlogscherm, en de inloggegevens stonden los van
  de accounts in de app.
- Conclusions: beheer achter de bestaande app-login gezet met een `admin`-rol. Geen
  automatische eerste beheerder, omdat de site publiek is; een bestaand account wordt
  expliciet gepromoveerd. De role-check zit ook in de server actions, niet alleen in de
  layout, zodat formulieren niet buiten de UI om aanroepbaar zijn.
- Actions:
  - `users.role` toegevoegd (migratie + `UserRole`), `requireAdmin()` in `auth.ts`.
  - Beheer-layout is async en roept `requireAdmin()` aan; alle zeven beheer-actions doen
    hetzelfde. Niet-admins gaan naar `/account?fout=geen-toegang`.
  - `scripts/set-admin.mjs` + `npm run admin -- <e-mail>` om te promoveren.
  - Accountpagina toont een beheerlink voor admins en een uitleg bij geweigerde toegang.
  - README bijgewerkt; Basic auth op de server verwijderd.

## 2026-11-25 (Smaakvoorkeur en boodschappenlijst)

- Findings: Het advies gaf alleen grammen en verhoudingen. Daardoor bleef het abstract: een
  bezoeker weet wel hoeveel karkas en spier er in het pakket zit, maar niet wat hij daarvoor
  in huis moet halen. De pakketten zijn wel vertaald naar "meer gemalen" en "meer karkas",
  maar er stonden geen concrete producten bij.
- Conclusions: De smaak van het dier bepaalt welke producten logisch zijn. Daarom is
  `likes` een onderdeel van het advies geworden en verdeelt de boodschappenlijst de grammen
  per samenstellingsdeel over de gekozen smaken. De catalogus noemt bewust gangbare
  ingrediënten (supermarkt, slager, visboer, online) in plaats van vaste SKU's: een advies
  moet bruikbaar blijven als een winkel iets niet heeft. Zonder smaakvoorkeur valt de lijst
  terug op een mix van vier gangbare smaken: kip, rund, lam en eend.
- Actions:
  - `src/lib/shopping.ts` toegevoegd met catalogus per eiwit en per deel (gemalen, karkas,
    spier, bot, orgaan), vis- en pensproducten, verdeling van grammen en winkelsamenvatting.
  - `AdviceInput` en `AdviceRecord` hebben `likes`; de adviestabel kreeg een `likes`-kolom
    met migratie voor bestaande databases.
  - Wizard stap 2 heeft een chipsblok "Waar is je dier dol op?"; de keuze wordt niet bij een
    opgeslagen dier bewaard, omdat smaak per advies kan verschillen.
  - Adviespagina toont een printbare boodschappenlijst met afvinkbare producten en een rij
    "Dol op" bij de wensen.
  - README en homepage-copy bijgewerkt.
  - Typecheck en build slagen; lokaal gecontroleerd met een hond (kip + eend, rund vermeden,
    meer karkas, 10 kg): de rundregel ontbreekt en de grammen zijn over kip en eend verdeeld.

## 2026-11-25 (DARF-producten in de boodschappenlijst)

- Findings: De boodschappenlijst noemde alleen generieke ingredienten. De DARF-catalogus
  (kof=107) bevat 130 producten, maar de oude import las alleen de ankertekst: gewicht en
  prijs waren daardoor onbetrouwbaar en "Niet leverbaar" belandde in de productnaam. De
  detailpagina's bevatten wel de ingrediënten en samenstelling, maar die werden niet gebruikt.
- Conclusions: Een ALRODA Puur-product is één dier met karkas, spier en orgaan; dat is de
  smaakbasis voor de delen gemalen, karkas en spier. Pens, orgaan, bot en vis moeten echte
  losse delen zijn, anders klopt de koppeling met de berekening niet. Complete KVV-maaltijden
  (DARF, MEAT4DOGS) blijven buiten beeld: die zouden de samenstelling vervangen in plaats van
  invullen. Zonder passend DARF-product blijft de generieke catalogus als fallback staan.
- Actions:
  - `scripts/import-darf.mjs` herschreven: productkaarten via `pcard-brand`, `pcard-name`,
    `pcard-weight`, `pcard-price` en labels; gewicht uit de kaart of slug; prijs uit de kaart
    of `pdp-price`. Detailpagina's leveren ingrediënten, samenstelling (`dc-hero`, `dc-otile`)
    en analyse (`dc-arow`) en worden gecachet in `.data/darf-cache`.
  - Classificatie toegevoegd: `heel` (ALRODA Puur), `pens`, `orgaan`, `bot`, `vis`, `spier`,
    `karkas`, `gemalen`, `compleet`, `vet`, `onbekend`; 130 producten in
    `data/darf-products.json` en `shop_products`, 128 leverbaar.
  - `src/lib/darf.ts` kiest per deel: heel dier op smaak (grootste verpakking die past),
    los orgaan (lever vóór hart vóór long), los bot (nek vóór kop vóór rib), pens op
    voorkeurssmaak en vis (zalm alleen als gekozen).
  - `src/lib/shopping.ts` koppelt elke regel eerst aan een DARF-product en valt anders terug
    op de generieke catalogus. De grammen en verhoudingen zijn niet aangepast.
  - Adviespagina toont per product gewicht, prijs en een externe link; `heel dier` staat als
    toelichting. Printbaarheid blijft: de linkiconen zijn `no-print`.
  - README bijgewerkt met de DARF-import, classificatie en het onderscheid tussen snapshot en
    rekenregels.
  - Getest: `npm run typecheck` en `npm run build` slagen. Lokaal een advies zonder likes
    (hond, 10 kg, PLUS) geeft 4 smaken en 6 concrete producten; een advies met kip + eend
    (10 kg, meer karkas) geeft kip/eend-karkas, kip/eend-spier, kip-orgaan, kip-bot en de
    generieke eend-orgaan-fallback; een advies met 6 smaken (kip, rund, lam, eend, hert,
    konijn, 10 kg, meer karkas) geeft voor elke smaak een heel-dierproduct en echte losse
    delen waar beschikbaar. De samenstelling bleef 15/15/35/5,3/11,9/17,8% (1500/1500/3500/
    530/1190/1780 g).
