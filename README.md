# OerVoer picklist-wizard

Webapp om picklijsten voor OerVoer-pakketten samen te stellen uit de actuele voorraad.
Gebouwd met Next.js 16, TypeScript, Tailwind CSS 4 en SQLite (via `node:sqlite`, geen native
dependency).

De oorspronkelijke repo was een Python 2 / GTK-desktopwizard met een halfaffe Django-port.
De rekenregels daarvan zijn één-op-één naar TypeScript vertaald in `src/lib/picklist.ts`.
De oude mappen blijven staan als referentie en zijn niet meer nodig om de app te draaien.

## Snel starten

Vereist Node.js 22 of nieuwer (de app gebruikt de ingebouwde SQLite-module).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Bij de eerste start wordt `.data/oervoer.db` aangemaakt en
gevuld met de producten uit `test/products.csv` en zes voorbeeldorders.

Productie:

```bash
npm run build
npm start
```

## Wat de app doet

- **Orders** — order aanmaken met dier, gewicht, pakkettype, portiegrootte, vermijdingen
  en smaakvoorkeuren. Zoeken en filteren op status.
- **Picklijst** — per order een menu genereren. De wizard rekent met de echte voorraad en
  trekt de gebruikte producten direct af.
- **Picklijst intrekken / opnieuw genereren** — de voorraad wordt eerst teruggeboekt, daarna
  opnieuw afgeboekt. Geen dubbele afboekingen.
- **Printen en CSV** — een compacte printweergave en een CSV-export per picklijst.
- **Voorraad** — 346 producten, zoeken, filteren op vleessoort, lage voorraad en
  uitverkocht, en aantallen direct bijwerken.

### Hoe de wizard rekent

De originele logica is aangehouden:

1. **Maaltijdgrootte** = lichaamsgewicht × factor ÷ 2, met factor 0,035 voor katten en
   0,025 voor honden (35 respectievelijk 25 gram voeding per kg per dag).
2. **Pakketopbouw**:
   - `100%` — 15% vis, 15% pens (alleen hond), de helft van de rest compleet karkas,
     daarna orgaan (15%), spiervlees (40%) en bot (rest).
   - `Gemalen Plus` — 15% vis, 15% pens (alleen hond), de rest compleet gemalen.
   - `Combinatie` — de helft van het pakket volgens `100%`, de andere helft `Gemalen Plus`.
3. **Selectie** — per vleessoort worden 20 menu's gegenereerd met een gewogen
   willekeurige keuze (voorraad weegt mee, voorkeurssmaken vier keer zwaarder). Het menu
   met de meeste smaakvariatie en de kleinste gewichtsafwijking wint.
4. **Restricties** — producten worden overgeslagen op smaak, smaakdeel (bijv. `KIP.LEVER`),
   vleessoort en op kat/hond-geschiktheid. Viskoppen komen maximaal één keer per menu voor.

De portievoorkeur (`kleine porties` / `grote porties`) grijpt alleen in bij gemalen, pens
en spiervlees: stukken tot 251 g respectievelijk vanaf 499 g.

## Projectstructuur

```
src/
  app/
    page.tsx                 dashboard
    orders/                  lijst, nieuwe order, detail, CSV-export
    voorraad/                voorraadbeheer
    actions.ts               server actions (order, picklijst, voorraad)
  components/                UI, orderformulier, actieknoppen
  lib/
    picklist.ts              port van de originele generator
    db.ts                    SQLite-schema, queries en seeding
    globals.ts               constanten uit globals.py
    csv.ts                   CSV-parser/exporter
test/products.csv            productbron voor de initiële voorraad
oervoer/, gtk/, data/        originele Python 2 / GTK-app (archief)
oervoer-django/              originele Django-poging (archief)
```

## Database

De SQLite-database staat in `.data/oervoer.db` en is git-ignored. Verwijder het bestand om
opnieuw te beginnen; de volgende start zaait opnieuw.

De tabellen zijn `products`, `orders` en `picklists`. Een picklijst bewaart een snapshot
van de regels, zodat printen en exporteren altijd hetzelfde resultaat geven, ook als de
voorraad daarna verandert.

## Nog niet inbegrepen

De originele brieven (de begeleidende brief per pakkettype) en de Magento-import zijn nog
niet overgezet. De briefteksten staan in `data/brief*.txt` en de Django-templates in
`oervoer-django/oervoer/src/wizard/templates/` en kunnen later als print-/mailtemplate
worden toegevoegd.
