# OerVoer voedingsadvies

Webapp waarmee bezoekers in drie stappen een voedingsadvies voor hun hond of kat maken, en
waarmee de slagerij erachter de orders, picklijsten en voorraad beheert. Bezoekers kunnen een
account maken om hun dieren (met foto) en gemaakte adviezen te bewaren; zonder account werkt
de wizard ook en houdt elk advies een eigen deelbare link. Gebouwd met Next.js
16, TypeScript, Tailwind CSS 4 en SQLite (via `node:sqlite`, geen native dependency).

De oorspronkelijke repo was een Python 2 / GTK-desktopwizard met een halfaffe Django-port.
De rekenregels daarvan zijn naar TypeScript vertaald: `src/lib/picklist.ts` voor de
picklijsten en `src/lib/advice.ts` voor het publieke advies. De oude mappen blijven staan als
referentie en zijn niet nodig om de app te draaien.

## Snel starten

Vereist Node.js 22 of nieuwer (de app gebruikt de ingebouwde SQLite-module).

```bash
npm install
npm run dev
```

Open <http://localhost:3000> voor de adviesapp en <http://localhost:3000/beheer> voor de
slagerij. Bij de eerste start wordt `.data/oervoer.db` aangemaakt en gevuld met de producten
uit `test/products.csv` en zes voorbeeldorders.

Productie:

```bash
npm run build
npm start
```

## Wat de app doet

### Advies (openbaar)

- **Drie stappen** — dier (soort, gewicht, pup/kitten), wensen (waar je dier dol op is, wat het
  niet eet en de voorkeur voor kleine of grote stukken) en stijl (menu-opbouw en pakketgrootte).
- **Direct resultaat** — gram per dag, gram per maaltijd, hoe lang het pakket meegaat en de
  procentuele samenstelling met grammen.
- **Smaakvoorkeur** — kies waar je dier dol op is. Die keuze bepaalt welke producten in de
  boodschappenlijst komen en hoe de grammen over de smaken worden verdeeld.
- **Boodschappenlijst** — bij elk advies horen concrete producten per samenstellingsdeel, met
  winkeltype (supermarkt, slager, visboer of online). Waar mogelijk staat er een echt
  DARF-product bij met gewicht, prijs en link; ontbreekt dat, dan valt de regel terug op een
  generieke suggestie. Afvinkbaar op papier en printbaar met het advies mee.
- **Eigen link** — elk advies wordt opgeslagen en is printbaar via `/advies/<id>`. Handig om
  mee te geven of later terug te zoeken.
- **Account** — registreren met naam, e-mail en een optionele profielfoto. Daarna kun je je
  dieren opslaan met foto, gewicht en wensen, en al je adviezen terugvinden op `/account`.
  Een dier kiezen in de wizard vult de gegevens voor je in.
- **Uitleg in gewone taal** — de interne pakketnamen zijn vertaald naar wat ze betekenen:
  *meer gemalen*, *meer karkas* en *van beide wat*.

### Beheer

- **Orders** — order aanmaken met dier, gewicht, pakkettype, portiegrootte, vermijdingen en
  smaakvoorkeuren. Zoeken en filteren op status.
- **Picklijst** — per order een menu genereren op basis van de echte voorraad; de gebruikte
  producten worden direct afgeboekt.
- **Opnieuw genereren of intrekken** — de voorraad wordt eerst teruggeboekt, daarna opnieuw
  afgeboekt. Geen dubbele afboekingen.
- **Printen en CSV** — een compacte printweergave en een CSV-export per picklijst.
- **Voorraad** — 346 producten, zoeken, filteren op vleessoort, lage voorraad en uitverkocht,
  en aantallen direct bijwerken.
- **Beveiligd** — beheer valt onder de gewone app-login. Alleen accounts met de rol `admin`
  komen erin; andere bezoekers worden naar hun account gestuurd.

## Hoe het rekent

Het dagrantsoen is lichaamsgewicht × factor, met 35 gram per kg voor katten en 25 gram per kg
voor honden. Puppy's en kittens krijgen drie maaltijden per dag, volwassen dieren twee. De
aanbevolen pakketgrootte is het kleinste pakket dat ongeveer vier weken meegaat.

De menu-opbouw volgt de originele generator:

| Intern | Voor de bezoeker | Opbouw |
| --- | --- | --- |
| `Gemalen Plus` | Meer gemalen | 15% vis, 15% pens (alleen hond), rest gemalen vlees |
| `100% OerVoer` | Meer karkas | 15% vis, 15% pens (alleen hond), helft van de rest karkas, daarna orgaan (15%), spiervlees (40%) en bot (rest) |
| `Combinatie` | Van beide wat | de helft volgens `100%`, de helft volgens `Gemalen Plus` |

Bij het advies worden vis en pens overgeslagen als de bezoeker die uitsluit; de ruimte gaat
naar de overige onderdelen. Katten krijgen standaard geen pens. De percentages worden op één
decimaal afgerond en de grammen daarvan afgeleid, zodat de samenstelling altijd optelt tot
100%.

De picklijsten gebruiken dezelfde verhoudingen, maar selecteren daadwerkelijk producten uit
de voorraad. Per vleessoort worden 20 menu's gegenereerd met een gewogen willekeurige keuze
(voorraad weegt mee, voorkeurssmaken vier keer zwaarder). Het menu met de meeste
smaakvariatie en de kleinste gewichtsafwijking wint. Restricties gelden op smaak, smaakdeel
(bijv. `KIP.LEVER`), vleessoort en kat/hond-geschiktheid; viskoppen komen maximaal één keer
per menu voor.

### Calcium en fosfor

Bij elk advies en elke picklijst wordt het calcium- en fosforgehalte berekend. Dat gebeurt per
100 g voer, want botpercentage is daar geen maat voor: in de DARF-catalogus bevat kipnek 0,39%
calcium en lamsbot 0,13%, en karkassen lopen op tot 1,30%. Een menu met veel lam- of rundbot
kan dus evenveel "bot" hebben als een menu met gevogeltebot en toch te weinig calcium leveren.

| bron | waar |
| --- | --- |
| DARF-producten | analyse in `data/darf-products.json` (calcium en fosfor per 100 g) |
| eigen SKU's | `products.calcium` / `products.fosfor`, gevuld uit `data/product-nutrition.csv` |
| ontbreekt een waarde | terugval per vleestype in `src/lib/minerals.ts` |

De uitkomst wordt getoetst aan de band van FEDIAF (2025): calcium in g per 100 g droge stof en
per 1000 kcal, omgerekend naar g per 100 g voer bij ~30% droge stof.

| dier | calcium per 100 g voer | calcium per 1000 kcal |
| --- | --- | --- |
| volwassen hond | 0,17 – 0,75 | 1,45 – 6,25 |
| pup (vroege groei, < 14 weken) | 0,30 – 0,48 | 2,50 – 4,00 |
| volwassen kat | vanaf 0,16 | vanaf 1,33 |
| kitten | vanaf 0,30 | vanaf 2,50 |

De calcium/fosfor-verhouding hoort tussen 1:1 en 2:1 te liggen (bij groei tot 1,8:1). Het
advies toont de cijfers naast de samenstelling, de boodschappenlijst toont ze per regel en de
picklijst krijgt een `Ca`-kolom plus een tegel met het oordeel; de CSV-export bevat
`calcium_pct`, `fosfor_pct`, `energie_kcal_per_100g` en een samenvatting onderaan.

De DARF-detailpagina's gebruiken per product andere labels voor dezelfde analyse ("Ruw eiwit",
"Ruw Eiwit", "Ruwe as", "Vezels", "Ruwe celstof", "Energie Kcal / 100g", "Clacium"). Het
importscript trekt die labels gelijk naar één canonieke set met getallen, waardoor de energie
bij 120 van de 130 producten uit de opgave komt. Waar de fabrikant geen energie publiceert
vult het script die aan met de gemodificeerde Atwater-factoren (4/9/4 uit vocht, eiwit, vet,
celstof en as) en markeert dat als `schatting`; op de 97 producten waar beide bekend zijn wijkt
die schatting gemiddeld 7,4% af van de opgave (de EU-factoren 3,5/8,5/3,5 komen op 11,4% uit).
Het advies en de picklijst melden de herkomst erbij. Een bestaande snapshot bijwerken kan
zonder netwerk met `node scripts/import-darf.mjs --normalise-only`.

De omrekening per 1000 kcal lukt alleen als elke regel een energiewaarde heeft. Ontbreekt die
(bij 7 DARF-producten, waaronder lamsbot waarvan de analyse zelf niet sluitend is), dan staat
die regel op "onbekend". Voor eigen SKU's komt de energie uit de optionele kolom `energie` in
`data/product-nutrition.csv`; zonder eigen waarde geldt de terugval per vleestype.

### Calcium stuurt de picklijst

Het restdeel van een menu (bot bij `100%` en `Combinatie`, gemalen vlees bij `Gemalen Plus`)
bepaalt vrijwel het hele calciumgehalte. De generator rekent daarom eerst uit wat dat deel per
100 g moet bevatten om het menu op het midden van de band te krijgen (of 1,5× de ondergrens als
de norm geen bovengrens noemt, zoals bij katten) en stuurt daar op drie manieren op:

1. **Weging** — kandidaten voor het restdeel die dichter bij het benodigde calcium zitten wegen
   zwaarder. De voorraad blijft meewegen, dus dit is een voorkeur en geen eis.
2. **Keuze** — onder de 20 gegenereerde menu's per vleessoort wint degene die het dichtst bij het
   benodigde calcium zit, en pas daarna die met de meeste smaakvariatie.
3. **Reparatie** — valt het eindmenu buiten de band, dan worden de botregels verwisseld met
   andere botten uit de voorraad zolang dat het menu dichter bij de band brengt.

Wat niet te repareren valt, blijft staan en komt als waarschuwing bij de picklijst te staan,
met het gemeten gehalte, de norm en een concrete suggestie. De sturing is uit te zetten met
`generatePicklist(order, products, seed, { steerCalcium: false })`, bijvoorbeeld om te
vergelijken.

### Smaakvoorkeur vult aan, vervangt niet

Een voorkeur is een voorkeur, geen filter. In de boodschappenlijst van het advies gebeurde dat
wel: met alleen "kip" aangevinkt bestond het hele menu uit kip — karkas, orgaan, spier én bot —
en viel de standaardmix van vier smaken weg. Nu geldt:

- de aangevinkte smaak komt **vooraan** en de standaardmix vult aan tot vier smaken
  (`meatChoicesFor` in `src/lib/shopping.ts`);
- die smaak krijgt **40% van elk deel**, de andere drie verdelen de rest
  (`splitGramsWeighted`, gewicht 2 tegen 1);
- bij twee voorkeuren krijgt elk 33% en de rest 17%.

In de picklijst (`src/lib/picklist.ts`) geldt hetzelfde idee: een voorkeur matcht nu op het
smaakdeel, dus "KIP" telt ook voor `KIP.HART` en `KIP.LEVER` (eerst matchte alleen de exacte
waarde, waardoor een voorkeur bijna nergens op sloeg). De weging blijft 4×, maar het aandeel
van de voorkeurssmaak in een menuonderdeel is afgetopt op `PREFERENCE_SHARE` (40%, in
`src/lib/globals.ts`): boven die grens wordt de rest van dat deel uit andere smaken gevuld.
Zijn er geen andere smaken in de voorraad, dan vervalt de grens en vult het menu gewoon.

## DARF-producten

De boodschappenlijst verwijst naar echte producten uit de DARF Versvoer-catalogus. Die
catalogus wordt met een script ingelezen en als snapshot in `data/darf-products.json`
bewaard; dezelfde producten staan in de tabel `shop_products`.

```bash
node scripts/import-darf.mjs              # 15 categoriepagina's, detailpagina's uit cache
node scripts/import-darf.mjs --refresh    # detailpagina's opnieuw ophalen
node scripts/import-darf.mjs --no-details # alleen kaartdata (snel, zonder ingrediënten)
```

Het script leest per productkaart merk, naam, gewicht en prijs, en haalt van de detailpagina
de ingrediënten, samenstelling en analyse op. Op basis daarvan krijgt elk product een deel:

| Deel | Betekenis |
| --- | --- |
| `heel` | ALRODA Puur van één dier (karkas, spier en orgaan in één product) |
| `pens`, `orgaan`, `bot`, `vis` | Echte losse delen uit de BARF- en ALRODA-lijn |
| `spier`, `karkas`, `gemalen` | Overige losse delen |
| `compleet` | Kant-en-klare KVV-maaltijd; doet niet mee in het advies |
| `vet`, `onbekend` | Niet bruikbaar of niet meer leverbaar |

`shoppingListFor` gebruikt een heel-dierproduct als smaakbasis voor de delen gemalen, karkas
en spier. Pens, orgaan, bot en vis komen uit de losse delen. Zo blijft de berekende
samenstelling leidend en worden er geen complete KVV-maaltijden als vervanging getoond. Als
een product voor een smaak of deel ontbreekt, valt de regel terug op de generieke catalogus.

Prijzen en gewichten zijn een momentopname van darf.nl. De app toont ze als voorbeeld; de
grammen uit het advies blijven de norm. De detailpagina's worden lokaal gecachet in
`.data/darf-cache` (git-ignored) zodat opnieuw importeren snel gaat.

## Voercheck en dieetdagboek

Naast het advies ("wat heeft je dier nodig") is er de voercheck: het baasje voert in wat het dier
op dit moment eet en de app telt op wat daarvan binnenkomt. Te vinden als tab boven de wizard op
de homepage (`/?tab=voercheck`).

- **Invoer** — zoeken in de catalogus (`/api/catalog/search`), grammen invullen, regels toevoegen.
  Per regel staat de herkomst: `catalogus`, `USDA` of `eigen opgave`.
- **Uitkomst** — totaal gram, calcium en fosfor per 100 g voer, Ca:P, energie, eiwit en vet, en het
  oordeel tegen de band van dat dier. Dezelfde rekenkern als het advies (`src/lib/minerals.ts`),
  dus geen tweede waarheid over calcium.
- **Bewaren** — per dier en per dag in `diet_items`, met de waarden van dat moment (een latere
  cataloguswijziging verandert het verleden niet). Het dagboek staat onder de check.
- **Delen** — een momentopname met een eigen, niet te raden link (`/voercheck/r/<token>`, tabel
  `diet_reports`), zodat een klant het met de dierenarts kan delen.
- **Toon** — feitelijk, met één regel "overleg met je dierenarts"; geen diagnose en geen claim.

### Generieke ingrediënten (USDA)

De catalogus bevat de producten van de rauwvoerleveranciers; wat een baasje bij de slager of
supermarkt haalt staat daar niet in. Daarvoor is er `data/ingredient-nutrition.csv` met 40
ingrediënten (kipfilet, rundergehakt, runderlever, zalm, ei, wortel, rijst, olie, …), met per regel
de gebruikte USDA-regel zodat elk cijfer herleidbaar is.

```bash
# eenmalig: CSV opnieuw maken uit de USDA SR Legacy bulk-CSV
python3 scripts/maak-ingredienten.py /pad/naar/FoodData_Central_sr_legacy_food_csv_2018-04.zip
# en in de catalogus zetten
npm run catalog:scan -- --source=usda
```

Bron: USDA FoodData Central, SR Legacy (2018), publiek domein; calcium en fosfor omgerekend van mg
naar g per 100 g. NEVO (RIVM) is de Nederlandse aanvulling, maar dat bestand komt via een formulier
vrij — de bron staat al klaar in `catalog_sources`.

## Catalogus

De catalogus is de productdatabase waar de app voedingswaarden uit haalt: welke producten
bestaan er, wat zit erin, en wat is de analyse. Hij staat los van de voorraad (`products` is
wat OerVoer zelf verkoopt, `catalog_products` is wat een baasje zou kunnen voeren) en wordt
gevuld door een scanner die de bron bijhoudt.

**Bronnen.** Nu `darf.nl` — dat levert 340 productpagina's op, vier keer zoveel als de 130 die
de oude import via vijftien categoriepagina's ophaalde. Dezelfde scanner kan later NEVO (RIVM)
en USDA FoodData Central als dataset inlezen en Bo's eigen producten als handmatige bron; die
bronnen staan al in `catalog_sources`.

**Bijhouden.**

```bash
npm run catalog:scan                     # hele darf-sitemap langs (≈10 min, 1,5 s per pagina)
npm run catalog:scan -- --limit 20       # eerste 20 (proefrun)
npm run catalog:scan -- --only=<slug>    # één product opnieuw
npm run catalog:scan -- --import-snapshot  # bestaande data/darf-products.json inlezen
npm run catalog:scan -- --dry-run        # laten zien wat er zou gebeuren
npm run catalog:stats                    # stand: aantallen en laatste run
npm run catalog:pending                  # wijzigingen die op goedkeuring wachten
npm run catalog:scan -- --approve 12     # goedkeuren (of --reject 12)
```

**Wat de scanner wel en niet doet.** Hij leest `robots.txt` (darf.nl staat alles toe), wacht
1,5 s tussen verzoeken, gebruikt een herkenbare user-agent en probeert een mislukte pagina
drie keer opnieuw. Elke wijziging wordt per veld in `catalog_changes` vastgelegd. Een nieuwe
waarde voor calcium, fosfor of energie wordt overgenomen als de afwijking ≤ 10% is; is die
groter, dan blijft de oude waarde staan en wacht de nieuwe op goedkeuring. Een getal wordt
nooit met leeg overschreven, en een product dat uit de sitemap verdwijnt gaat pas na drie
gemiste runs op inactief. Doorverwijzingen (darf.nl stuurt korte slugs door naar de volledige
productpagina) worden op de canonieke slug geschreven en de korte slug wordt een alias, zodat
er geen dubbele producten ontstaan.

**Zoeken.** `GET /api/catalog/search?q=kipnek` geeft producten met calcium, fosfor, energie en
de herkomst (`opgave`, of leeg als de bron niets noemt). Elk woord uit de zoekterm moet in de
naam of een alias voorkomen, dus "kip nek" en "alroda geit" werken ook.

De scanner draait op de server als systemd-timer `oervoer-catalog.timer` (wekelijks, zondag
03:30 met spreiding, als gebruiker `espenvdh`). Handmatig dezelfde run starten:

```bash
sudo systemctl start oervoer-catalog.service
journalctl -u oervoer-catalog.service -n 20
```

De units hieronder staan ook echt zo op de server:

```ini
# /etc/systemd/system/oervoer-catalog.service
[Unit]
Description=OerVoer catalogus bijwerken

[Service]
Type=oneshot
User=espenvdh
WorkingDirectory=/var/www/vhosts/studiovanderheide.nl/oer.studiovanderheide.nl/app
Environment=PATH=/opt/plesk/node/22/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/opt/plesk/node/22/bin/node scripts/catalog-scan.mjs --quiet

# /etc/systemd/system/oervoer-catalog.timer
[Unit]
Description=Wekelijks de OerVoer-catalogus bijwerken

[Timer]
OnCalendar=Sun 03:30
Persistent=true
RandomizedDelaySec=1800

[Install]
WantedBy=timers.target
```

## Projectstructuur

```
src/
  app/
    (public)/
      page.tsx               advieswizard en uitleg
      advies/[id]/page.tsx   printbaar advies
      inloggen/page.tsx      inloggen
      registreren/page.tsx   account aanmaken
      account/page.tsx       profiel, dieren en adviezen
      account/dieren/        dier toevoegen en bewerken
      layout.tsx             publieke header en footer
      not-found.tsx
    foto/[id]/route.ts       foto's uit de database
    (beheer)/beheer/
      page.tsx               dashboard
      orders/                lijst, nieuwe order, detail, CSV-export
      voorraad/              voorraadbeheer
      layout.tsx             sidebar
    actions.ts               server actions (advies, order, picklijst, voorraad)
    account-actions.ts       server actions (registreren, inloggen, dieren, profiel)
  components/                wizard, formulieren, foto-upload, UI
  lib/
    advice.ts                dagrantsoen en menu-opbouw voor het advies
    shopping.ts              boodschappenlijst per smaak, met DARF en fallback
    darf.ts                  DARF-producten kiezen per samenstellingsdeel
    catalog.ts               catalogus: schema, zoeken, statistieken, wachtende wijzigingen
    auth.ts                  wachtwoorden, sessies en cookie
    photo.ts                 uploadvalidatie en opslag als BLOB
    picklist.ts              port van de originele generator
    db.ts                    SQLite-schema, queries en seeding
    globals.ts               constanten uit globals.py
    minerals.ts              calciumbanden, terugvalwaarden en de mineralenberekening
    csv.ts                   CSV-parser/exporter
scripts/import-darf.mjs      DARF-catalogus scrapen naar JSON en shop_products
scripts/catalog-scan.mjs     catalogus bijhouden (sitemap, wijzigingen, goedkeuring)
scripts/lib/darf-parse.mjs   DARF-pagina's lezen (cheerio) en producten afleiden
scripts/set-admin.mjs        account promoveren tot beheerder
db/catalog.sql               opbouw van de catalogustabellen (app én scanner)
data/darf-products.json      snapshot van de DARF-producten voor de app
data/product-nutrition.csv   eigen calcium- en fosforanalyses per SKU (g per 100 g)
test/products.csv            productbron voor de initiële voorraad
oervoer/, gtk/               originele Python 2 / GTK-app (archief)
data/                        DARF-snapshot en archiefbestanden
oervoer-django/              originele Django-poging (archief)
```

## Database

De SQLite-database staat in `.data/oervoer.db` en is git-ignored. Verwijder het bestand om
opnieuw te beginnen; de volgende start zaait opnieuw.

De tabellen zijn `products`, `orders`, `picklists`, `advices`, `users`, `pets`, `sessions`,
`photos`, `shop_products` en de catalogustabellen `catalog_sources`, `catalog_products`,
`catalog_runs`, `catalog_changes` en `catalog_aliases`. In `advices.likes` staan de gekozen smaken; `users.role` bepaalt
wie beheer mag openen. `products.calcium` en `products.fosfor` (g per 100 g product) worden bij
het starten gevuld uit `data/product-nutrition.csv` en blijven staan bij een herseed; ontbreekt
een waarde, dan geldt de terugval per vleestype uit `src/lib/minerals.ts`. Een picklijst bewaart een snapshot van de regels en een advies bewaart
de volledige uitkomst, zodat printen altijd hetzelfde resultaat geeft, ook als de voorraad of
de rekenregels daarna veranderen. Een advies van een ingelogde bezoeker verwijst naar het
account en, indien gekozen, naar het opgeslagen dier.

Wachtwoorden worden met scrypt gehasht; de sessiecookie is httpOnly en bevat alleen een token
waarvan de hash in de database staat. Profielfoto's worden verkleind tot maximaal 720 px en als
BLOB in SQLite bewaard. Ze zijn bereikbaar via `/foto/<id>` met een willekeurige id, zodat ze
niet te raden zijn maar wel op een gedeeld advies kunnen worden getoond.

## Deployment

De app draait op de Plesk-server van Strato als subdomein van `studiovanderheide.nl`:

- **URL:** https://oer.studiovanderheide.nl
- **App-map:** `/var/www/vhosts/studiovanderheide.nl/oer.studiovanderheide.nl/app`
- **Node:** `/opt/plesk/node/22/bin/node` (Plesk-node 22)
- **Proces:** systemd-unit `oervoer`, geluisterd op `127.0.0.1:4310`
- **Proxy:** Plesk-nginx (80/443) → Node. De regel staat in
  `/var/www/vhosts/system/oer.studiovanderheide.nl/conf/vhost_nginx.conf`.

`/beheer` valt onder de gewone app-login. Uitgelogde bezoekers gaan naar `/inloggen`, accounts
zonder admin-rol naar `/account`. Een bestaand account promoveren doe je op de server:

```bash
cd /var/www/vhosts/studiovanderheide.nl/oer.studiovanderheide.nl/app
npm run admin -- iemand@voorbeeld.nl
```

Het account moet zich eerst via de site hebben geregistreerd. De rol staat in `users.role`;
er wordt bewust geen eerste gebruiker automatisch admin gemaakt.

### Bijwerken

```bash
cd /var/www/vhosts/studiovanderheide.nl/oer.studiovanderheide.nl/app
runuser -u espenvdh -- git pull
runuser -u espenvdh -- env -C "$PWD" HOME=/var/www/vhosts/studiovanderheide.nl \
  PATH=/opt/plesk/node/22/bin:/usr/local/bin:/usr/bin:/bin npm ci --include=dev
runuser -u espenvdh -- env -C "$PWD" HOME=/var/www/vhosts/studiovanderheide.nl \
  PATH=/opt/plesk/node/22/bin:/usr/local/bin:/usr/bin:/bin npm run build
systemctl restart oervoer
```

`--include=dev` is nodig: zonder de devDependencies wordt Tailwind niet gebouwd. De `env -C`
voorkomt dat npm in de subscription-root terechtkomt en PostCSS zijn plugin niet vindt.

### Backup

De database staat in `.data/oervoer.db` (WAL-modus). Een consistente kopie maak je met
`sqlite3 ... ".backup ..."`; gewoon `cp` is niet betrouwbaar zolang de app schrijft.

Op de server draait daarvoor een dagelijkse cron:

- **Script:** `/usr/local/sbin/oervoer-backup.sh`
- **Cron:** `/etc/cron.d/oervoer-backup`, elke dag om 03:15
- **Bestemming:** `/root/backups/oervoer-YYYY-MM-DD.db` (14 dagen bewaard)
- **Log:** `/var/log/oervoer-backup.log`

Het script controleert na het kopiëren de integriteit en verwijdert daarna pas de oude
backups. Handmatig een extra backup maken kan met:

```bash
/usr/local/sbin/oervoer-backup.sh
```

## Bewust niet gedaan

- De berekening blijft bij grammen en verhoudingen. De boodschappenlijst noemt concrete
  DARF-producten als voorbeeld, maar dat is een momentopname van de webshop en geen
  onderdeel van de rekenregels. De slagerij gebruikt voor de picklijst nog steeds de eigen
  voorraad.
- Het advies is een berekening, geen medisch advies. Bij puppy's, kittens en dieren met een
  aandoening staat een waarschuwing om met de dierenarts te overleggen.
- Accounts zijn bewust eenvoudig: geen e-mailverificatie, wachtwoord-reset of inloggen via een
  externe provider. Een vergeten wachtwoord kan alleen door de beheerder worden hersteld.
- De originele brieven (de begeleidende brief per pakkettype) en de Magento-import zijn nog
  niet overgezet. De briefteksten staan in `data/brief*.txt` en de Django-templates in
  `oervoer-django/oervoer/src/wizard/templates/`.
