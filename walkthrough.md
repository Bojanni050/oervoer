# Walkthrough

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
