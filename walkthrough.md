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
