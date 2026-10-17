exports.up = function(knex) {
  let createQuery = `CREATE TABLE IF NOT EXISTS organization_import_log (
    import_log_id SERIAL PRIMARY KEY,
    import_id TEXT NOT NULL,
    organization_id INT NOT NULL,
    imported_by TEXT,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    before_row JSONB NOT NULL,
    after_row JSONB NOT NULL
  )`
  return knex.raw(createQuery)
    .then(() => knex.raw(`CREATE INDEX IF NOT EXISTS organization_import_log_import_id_idx ON organization_import_log (import_id)`));
};

exports.down = function(knex) {
  let dropQuery = `DROP TABLE organization_import_log`
  return knex.raw(dropQuery)
};
