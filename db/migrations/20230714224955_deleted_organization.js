/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex
    .raw(`CREATE TABLE IF NOT EXISTS deleted_organization AS TABLE organization WITH NO DATA`)
    .then(() => knex.raw(`
        CREATE FUNCTION move_deleted_organization() RETURNS trigger AS $$
        BEGIN
          INSERT INTO deleted_organization VALUES((OLD).*);
          RETURN OLD;
        END;
      $$ LANGUAGE plpgsql;`)
    ).then(() => knex.raw(`CREATE TRIGGER move_deleted_organization
      BEFORE DELETE ON organization
      FOR EACH ROW
      EXECUTE PROCEDURE move_deleted_organization();`));
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex
  .raw(`DROP TRIGGER move_deleted_organization ON organization;`)
  .then(() => knex.raw(`DROP FUNCTION move_deleted_organization;`))
  .then(() => knex.raw(`DROP TABLE deleted_organization;`))
};
