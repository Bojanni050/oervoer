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

- **Drie stappen** — dier (soort, gewicht, pup/kitten), wensen (wat je dier niet eet en de
  voorkeur voor kleine of grote stukken) en stijl (menu-opbouw en pakketgrootte).
- **Direct resultaat** — gram per dag, gram per maaltijd, hoe lang het pakket meegaat en de
  procentuele samenstelling met grammen.
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
    auth.ts                  wachtwoorden, sessies en cookie
    photo.ts                 uploadvalidatie en opslag als BLOB
    picklist.ts              port van de originele generator
    db.ts                    SQLite-schema, queries en seeding
    globals.ts               constanten uit globals.py
    csv.ts                   CSV-parser/exporter
scripts/set-admin.mjs        account promoveren tot beheerder
test/products.csv            productbron voor de initiële voorraad
oervoer/, gtk/, data/        originele Python 2 / GTK-app (archief)
oervoer-django/              originele Django-poging (archief)
```

## Database

De SQLite-database staat in `.data/oervoer.db` en is git-ignored. Verwijder het bestand om
opnieuw te beginnen; de volgende start zaait opnieuw.

De tabellen zijn `products`, `orders`, `picklists`, `advices`, `users`, `pets`, `sessions` en
`photos`. Een picklijst bewaart een snapshot van de regels en een advies bewaart de volledige
uitkomst, zodat printen altijd hetzelfde resultaat geeft, ook als de voorraad of de rekenregels
daarna veranderen. Een advies van een ingelogde bezoeker verwijst naar het account en,
indien gekozen, naar het opgeslagen dier.

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

- Het advies noemt geen concrete producten of SKU's; het blijft bij grammen en verhoudingen.
  De vertaling naar echte producten gebeurt in de picklijst.
- Het advies is een berekening, geen medisch advies. Bij puppy's, kittens en dieren met een
  aandoening staat een waarschuwing om met de dierenarts te overleggen.
- Accounts zijn bewust eenvoudig: geen e-mailverificatie, wachtwoord-reset of inloggen via een
  externe provider. Een vergeten wachtwoord kan alleen door de beheerder worden hersteld.
- De originele brieven (de begeleidende brief per pakkettype) en de Magento-import zijn nog
  niet overgezet. De briefteksten staan in `data/brief*.txt` en de Django-templates in
  `oervoer-django/oervoer/src/wizard/templates/`.
