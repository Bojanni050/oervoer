#!/usr/bin/env node
/**
 * Promoveer een bestaand account tot beheerder.
 * Gebruik: npm run admin -- iemand@voorbeeld.nl
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Gebruik: npm run admin -- <e-mailadres>");
  process.exit(1);
}

const dbFile = path.join(process.cwd(), ".data", "oervoer.db");
if (!fs.existsSync(dbFile)) {
  console.error(`Database niet gevonden: ${dbFile}`);
  process.exit(1);
}

const db = new DatabaseSync(dbFile);
try {
  const row = db
    .prepare("SELECT id, name, email, role FROM users WHERE lower(email) = ?")
    .get(email);

  if (!row) {
    console.error(`Geen account gevonden voor ${email}. Registreer eerst via de website.`);
    process.exit(1);
  }

  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(row.id);
  console.log(`${row.email} (${row.name}) is nu beheerder.`);
} finally {
  db.close();
}
