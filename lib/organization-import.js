"use strict";

const crypto = require("crypto");
const csv = require("csv/sync");

const ORGANIZATION_EXPORT_SQL = `
    SELECT
      o.organization_id,
      o.organization_name,
      o.website,
      o.phone_number,
      o.org_address,
      o.org_description,
      o.schedule,
      o.gender,
      o.kids,
      o.active::text,
      o.last_update::text,
      o.zipcode,
      o.contact_name,
      o.contact_email,
      o.contact_phone,
      o.contact_title,
      o.sponsorship::text,
      o.distribution::text,
      o.id_req::text,
      o.sponsorship_email,
      o.distribution_email,
      o.org_description_es,
      o.org_address_es,
      o.schedule_es,
      join2.print_locations

    FROM organization o
    LEFT OUTER JOIN (
      SELECT oxc2.organization_id, oxc2.active, oxc2.print_location, ARRAY_AGG(c.category_name) AS print_locations
      FROM organization_x_category oxc2
      LEFT JOIN category c ON (oxc2.category_id = c.category_id)
      GROUP BY oxc2.organization_id, oxc2.active, oxc2.print_location
    ) join2 ON ((o.organization_id = join2.organization_id) AND join2.active='t' AND join2.print_location='t')
  `;

// max is the column's VARCHAR length; a longer value would fail the whole apply.
const IMPORTABLE_COLUMNS = {
  organization_name: { kind: "text", max: 255 },
  website: { kind: "text", max: 255 },
  phone_number: { kind: "text", max: 1024 },
  org_address: { kind: "text", max: 1024 },
  org_description: { kind: "text", max: 2000 },
  schedule: { kind: "text", max: 1024 },
  gender: { kind: "enum", values: ["no restrictions", "men only", "women only"] },
  kids: { kind: "text", max: 64 },
  active: { kind: "boolean" },
  zipcode: { kind: "integer" },
  contact_name: { kind: "text", max: 255 },
  contact_email: { kind: "text", max: 255 },
  contact_phone: { kind: "text", max: 255 },
  contact_title: { kind: "text", max: 255 },
  sponsorship: { kind: "boolean" },
  distribution: { kind: "boolean" },
  id_req: { kind: "boolean" },
  sponsorship_email: { kind: "text", max: 255 },
  distribution_email: { kind: "text", max: 255 },
  org_description_es: { kind: "text" },
  org_address_es: { kind: "text" },
  schedule_es: { kind: "text" },
};
const KEY_COLUMN = "organization_id";
const IGNORED_COLUMNS = ["last_update", "print_locations"];

const BOOLEAN_WORDS = { true: true, t: true, yes: true, false: false, f: false, no: false };
const MAX_INT = 2147483647;

function normalizeText(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/\r\n?/g, "\n")
    .trim();
}

// Each kind turns the export's representation of a DB value and an uploaded
// cell into the same comparable value. fromCell receives the DB side so a blank
// cell can mean "still null" where blank is not otherwise a valid value.
const KINDS = {
  text: {
    fromDb: normalizeText,
    fromCell: function (cell, current, spec) {
      const value = normalizeText(cell);
      if (value === current) return { value: value };
      // U+FFFD is what the browser substitutes when the file is not UTF-8, e.g. Excel's plain "CSV" format.
      if (value.indexOf("\uFFFD") !== -1) {
        return { error: 'has unreadable characters; in Excel, save with "CSV UTF-8"' };
      }
      const length = Array.from(value).length;
      if (spec.max && length > spec.max) {
        return { error: `is ${length} characters; the limit is ${spec.max}` };
      }
      return { value: value };
    },
  },
  boolean: {
    fromDb: function (value) {
      return value === null || value === undefined ? null : value === "true";
    },
    fromCell: function (cell, current) {
      const word = cell.trim().toLowerCase();
      if (word === "" && current === null) return { value: null };
      if (Object.prototype.hasOwnProperty.call(BOOLEAN_WORDS, word)) return { value: BOOLEAN_WORDS[word] };
      return { error: `"${cell}" is not true or false` };
    },
  },
  integer: {
    fromDb: function (value) {
      return value === null || value === undefined ? null : Number(value);
    },
    fromCell: function (cell) {
      const digits = cell.trim();
      if (digits === "") return { value: null };
      if (!/^\d+$/.test(digits) || Number(digits) > MAX_INT) return { error: `"${cell}" is not a whole number` };
      return { value: Number(digits) };
    },
  },
  enum: {
    fromDb: function (value) {
      return value === null || value === undefined ? null : normalizeText(value).toLowerCase();
    },
    fromCell: function (cell, current, spec) {
      const word = normalizeText(cell).toLowerCase();
      if (word === "" && current === null) return { value: null };
      // Production rows hold values like "undefined" saved by the edit form; leave them alone unless edited.
      if (word === current || spec.values.indexOf(word) !== -1) return { value: word };
      return { error: `"${cell}" must be one of: ${spec.values.join(", ")}` };
    },
  },
};

// Matches how csv.stringify writes the export's print_locations array.
function exportedPrintLocations(value) {
  return value === null || value === undefined ? "" : JSON.stringify(value);
}

function indexById(rows) {
  const byId = new Map();
  rows.forEach(function (row) {
    byId.set(Number(row.organization_id), row);
  });
  return byId;
}

function loadOrganizationsById(db) {
  return db.query(ORGANIZATION_EXPORT_SQL).then(function (result) {
    return indexById(result.rows);
  });
}

function parseCsv(csvText) {
  let header = [];
  const records = csv.parse(csvText.replace(/^\uFEFF/, ""), {
    columns: function (names) {
      header = names.map(function (name) {
        return name.trim();
      });
      return header;
    },
    skip_empty_lines: true,
    relax_column_count: false,
    info: true,
  });
  return {
    header: header,
    // Spreadsheet row of each record: the header is row 1 and skipped blank lines still count.
    rows: records.map(function (entry) {
      return { row: entry.info.records + entry.info.empty_lines + 1, cells: entry.record };
    }),
  };
}

function isImportable(name) {
  return Object.prototype.hasOwnProperty.call(IMPORTABLE_COLUMNS, name);
}

function headerErrors(header) {
  const errors = [];
  const seen = new Set();
  header.forEach(function (name) {
    const known = name === KEY_COLUMN || isImportable(name) || IGNORED_COLUMNS.indexOf(name) !== -1;
    if (!known) errors.push({ row: 1, column: name, message: `unknown column "${name}"` });
    else if (seen.has(name)) errors.push({ row: 1, column: name, message: `column "${name}" appears more than once` });
    seen.add(name);
  });
  if (header.indexOf(KEY_COLUMN) === -1) {
    errors.push({ row: 1, column: KEY_COLUMN, message: `the ${KEY_COLUMN} column is required` });
  }
  return errors;
}

function isBlankRow(cells) {
  return Object.keys(cells).every(function (name) {
    return cells[name].trim() === "";
  });
}

function fingerprintOf(changes) {
  return crypto.createHash("sha256").update(JSON.stringify(changes)).digest("hex");
}

function planImport(csvText, currentRowsById) {
  const errors = [];
  const warnings = [];
  const changes = [];
  let unchangedCount = 0;

  function finish() {
    return {
      errors: errors,
      warnings: warnings,
      changes: changes,
      unchangedCount: unchangedCount,
      fingerprint: fingerprintOf(changes),
    };
  }

  let parsed;
  try {
    parsed = parseCsv(csvText);
  } catch (err) {
    errors.push({ row: err.lines || null, column: null, message: `could not read the CSV: ${err.message}` });
    return finish();
  }
  if (parsed.header.length === 0) {
    errors.push({ row: 1, column: null, message: "the file is empty" });
    return finish();
  }
  Array.prototype.push.apply(errors, headerErrors(parsed.header));
  if (errors.length > 0) return finish();

  const importable = parsed.header.filter(isImportable);
  const comparesPrintLocations = parsed.header.indexOf("print_locations") !== -1;
  const rowOfId = new Map();

  parsed.rows.forEach(function (entry) {
    const row = entry.row;
    const cells = entry.cells;
    if (isBlankRow(cells)) return;

    const idCell = cells[KEY_COLUMN].trim();
    if (idCell === "") {
      errors.push({ row: row, column: KEY_COLUMN, message: "new organizations are not supported here; use Add New Agency" });
      return;
    }
    if (!/^\d+$/.test(idCell)) {
      errors.push({ row: row, column: KEY_COLUMN, message: `"${idCell}" is not an organization id` });
      return;
    }
    const id = Number(idCell);
    const current = currentRowsById.get(id);
    if (!current) {
      errors.push({ row: row, column: KEY_COLUMN, message: `no organization has id ${id}` });
      return;
    }
    if (rowOfId.has(id)) {
      errors.push({ row: row, column: KEY_COLUMN, message: `organization ${id} already appears on row ${rowOfId.get(id)}` });
      return;
    }
    rowOfId.set(id, row);

    const errorsBeforeRow = errors.length;
    const fields = [];
    importable.forEach(function (column) {
      const spec = IMPORTABLE_COLUMNS[column];
      const kind = KINDS[spec.kind];
      const before = kind.fromDb(current[column]);
      const parsedCell = kind.fromCell(cells[column], before, spec);
      if (parsedCell.error) {
        errors.push({ row: row, column: column, message: parsedCell.error });
      } else if (parsedCell.value !== before) {
        fields.push({ column: column, before: current[column], after: parsedCell.value });
      }
    });

    if (comparesPrintLocations && cells.print_locations.trim() !== exportedPrintLocations(current.print_locations)) {
      warnings.push({
        row: row,
        column: "print_locations",
        message: "print location changes are not imported; edit categories in the org form",
      });
    }

    if (fields.length > 0) {
      changes.push({ organization_id: id, organization_name: current.organization_name, fields: fields });
    } else if (errors.length === errorsBeforeRow) {
      unchangedCount += 1;
    }
  });

  return finish();
}

class StaleImportError extends Error {
  constructor() {
    super("The data changed since your preview; upload again.");
    this.name = "StaleImportError";
  }
}

function newImportId() {
  return new Date().toISOString() + "-" + crypto.randomBytes(3).toString("hex");
}

// Column names come only from IMPORTABLE_COLUMNS keys, never from the upload.
function updateWithLogSql(fields) {
  const assignments = fields.map(function (field, i) {
    return `${field.column} = $${i + 4}`;
  });
  return `
    WITH before AS (
      SELECT to_jsonb(o) AS j FROM organization o WHERE organization_id = $1
    ), upd AS (
      UPDATE organization SET ${assignments.join(", ")}, last_update = NOW()
      WHERE organization_id = $1
      RETURNING to_jsonb(organization.*) AS j
    )
    INSERT INTO organization_import_log (import_id, organization_id, imported_by, before_row, after_row)
    SELECT $2, $1, $3, before.j, upd.j FROM before, upd`;
}

function withTransaction(pool, work) {
  return pool.connect().then(function (client) {
    return client
      .query("BEGIN")
      .then(function () {
        return work(client);
      })
      .then(
        function (result) {
          return client.query("COMMIT").then(function () {
            return result;
          });
        },
        function (err) {
          return client.query("ROLLBACK").then(function () {
            throw err;
          });
        }
      )
      .finally(function () {
        client.release();
      });
  });
}

function applyImport(pool, csvText, expectedFingerprint, importedBy) {
  return withTransaction(pool, async function (client) {
    await client.query("SELECT organization_id FROM organization FOR UPDATE");
    const plan = planImport(csvText, await loadOrganizationsById(client));
    if (plan.errors.length > 0 || plan.fingerprint !== expectedFingerprint) throw new StaleImportError();

    const importId = newImportId();
    for (const change of plan.changes) {
      const values = [change.organization_id, importId, importedBy || null].concat(
        change.fields.map(function (field) {
          return field.after;
        })
      );
      await client.query(updateWithLogSql(change.fields), values);
    }
    return { importId: importId, updatedCount: plan.changes.length };
  });
}

function quoteIdentifier(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

function undoImport(pool, importId, options) {
  const force = Boolean(options && options.force);
  return withTransaction(pool, async function (client) {
    const logs = await client.query(
      "SELECT organization_id, before_row, after_row FROM organization_import_log WHERE import_id = $1 ORDER BY import_log_id",
      [importId]
    );
    if (logs.rowCount === 0) throw new Error(`no import with id ${importId}`);

    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'organization' AND column_name <> 'organization_id'
       ORDER BY ordinal_position`
    );
    const names = columns.rows.map(function (row) {
      return quoteIdentifier(row.column_name);
    });
    const restoreSql = `
      UPDATE organization SET (${names.join(", ")}) = (
        SELECT ${names.map(function (name) { return "r." + name; }).join(", ")}
        FROM jsonb_populate_record(NULL::organization, $2::jsonb) r
      )
      WHERE organization_id = $1`;

    const restored = [];
    const skipped = [];
    for (const log of logs.rows) {
      const id = log.organization_id;
      // Compare as typed rows, not JSON text, so timestamps match regardless of session time zone.
      const state = await client.query(
        `SELECT o IS NOT DISTINCT FROM jsonb_populate_record(NULL::organization, $2::jsonb) AS is_after,
                o IS NOT DISTINCT FROM jsonb_populate_record(NULL::organization, $3::jsonb) AS is_before
         FROM organization o WHERE organization_id = $1 FOR UPDATE`,
        [id, log.after_row, log.before_row]
      );
      if (state.rowCount === 0) {
        skipped.push({ id: id, reason: "organization no longer exists" });
      } else if (state.rows[0].is_before) {
        skipped.push({ id: id, reason: "already restored" });
      } else if (!state.rows[0].is_after && !force) {
        skipped.push({ id: id, reason: "edited since import" });
      } else {
        await client.query(restoreSql, [id, log.before_row]);
        restored.push(id);
      }
    }
    return { restored: restored, skipped: skipped };
  });
}

module.exports = {
  ORGANIZATION_EXPORT_SQL: ORGANIZATION_EXPORT_SQL,
  StaleImportError: StaleImportError,
  indexById: indexById,
  loadOrganizationsById: loadOrganizationsById,
  planImport: planImport,
  applyImport: applyImport,
  undoImport: undoImport,
};
