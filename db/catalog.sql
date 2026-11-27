-- Catalogus: externe producten waarvan we de voedingswaarde kennen.
--
-- Eén bron van waarheid voor zowel de app (lezen) als de scanner (schrijven).
-- De scanner draait als los proces en kan de TypeScript van de app niet
-- importeren; daarom staat de opbouw hier in SQL en lezen beide kanten dit
-- bestand.

CREATE TABLE IF NOT EXISTS catalog_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'web',            -- web | dataset | handmatig
  active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_status TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES catalog_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,                   -- slug, sku of dataset-id
  url TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  animal TEXT NOT NULL DEFAULT '',             -- HOND | KAT | BEIDE
  flavor TEXT NOT NULL DEFAULT '',
  part TEXT NOT NULL DEFAULT '',               -- heel|karkas|bot|spier|orgaan|pens|vis|compleet|vet
  whole_animal INTEGER NOT NULL DEFAULT 0,
  weight_g INTEGER,
  price_cents INTEGER,
  available INTEGER NOT NULL DEFAULT 1,
  ingredients TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  composition_json TEXT NOT NULL DEFAULT '[]',
  analysis_json TEXT NOT NULL DEFAULT '{}',
  calcium REAL,                                -- g per 100 g product
  fosfor REAL,
  energie REAL,                                -- kcal per 100 g product
  calcium_source TEXT NOT NULL DEFAULT '',     -- opgave | schatting | leeg
  energie_source TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  missed_runs INTEGER NOT NULL DEFAULT 0,
  UNIQUE(source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_name ON catalog_products(name);
CREATE INDEX IF NOT EXISTS idx_catalog_products_brand ON catalog_products(brand);
CREATE INDEX IF NOT EXISTS idx_catalog_products_part ON catalog_products(part);
CREATE INDEX IF NOT EXISTS idx_catalog_products_active ON catalog_products(active);

CREATE TABLE IF NOT EXISTS catalog_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES catalog_sources(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'loopt',        -- loopt | ok | gedeeltelijk | fout
  found INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  changed INTEGER NOT NULL DEFAULT 0,
  unchanged INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS catalog_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  run_id INTEGER REFERENCES catalog_runs(id) ON DELETE SET NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  status TEXT NOT NULL DEFAULT 'overgenomen',  -- overgenomen | wacht | afgekeurd
  changed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_changes_product ON catalog_changes(product_id);
CREATE INDEX IF NOT EXISTS idx_catalog_changes_status ON catalog_changes(status);

CREATE TABLE IF NOT EXISTS catalog_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  UNIQUE(product_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_catalog_aliases_alias ON catalog_aliases(alias);

INSERT OR IGNORE INTO catalog_sources (source_key, name, base_url, kind, active, created_at)
VALUES
  ('darf', 'darf.nl', 'https://darf.nl', 'web', 1, datetime('now')),
  ('nevo', 'NEVO (RIVM)', '', 'dataset', 1, datetime('now')),
  ('usda', 'USDA FoodData Central', '', 'dataset', 1, datetime('now')),
  ('eigen', 'Eigen producten', '', 'handmatig', 1, datetime('now'));
