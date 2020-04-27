exports.up = function(knex) {
  let createQuery = `CREATE TABLE IF NOT EXISTS organization_x_category (
    match_id SERIAL PRIMARY KEY,
    organization_id INT,
    category_id INT,
    active BOOLEAN
  )`
  return knex.raw(createQuery)
};

exports.down = function(knex) {
  let dropQuery = `DROP TABLE organization_x_category`
  return knex.raw(dropQuery)
};
