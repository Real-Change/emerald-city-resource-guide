"use strict";

// Usage: node db/undo-import.js <import_id> [--force]
require("dotenv").config();
const pg = require("pg");
const { undoImport } = require("../lib/organization-import");

const args = process.argv.slice(2);
const force = args.indexOf("--force") !== -1;
const importId = args.filter(function (arg) {
  return arg !== "--force";
})[0];

if (!importId || args.length > (force ? 2 : 1)) {
  console.error("Usage: node db/undo-import.js <import_id> [--force]");
  process.exit(2);
}

// Same connection setup as server.js; PGSSLMODE=disable turns SSL off locally.
pg.defaults.ssl = true;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

undoImport(pool, importId, { force: force })
  .then(function (result) {
    console.log(`Restored ${result.restored.length}: ${result.restored.join(", ") || "none"}`);
    console.log(`Skipped ${result.skipped.length}`);
    result.skipped.forEach(function (skip) {
      console.log(`  ${skip.id}: ${skip.reason}`);
    });
    const edited = result.skipped.some(function (skip) {
      return skip.reason === "edited since import";
    });
    if (edited) {
      console.log("Re-run with --force to overwrite the edits made since the import.");
    }
  })
  .catch(function (err) {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(function () {
    return pool.end();
  });
