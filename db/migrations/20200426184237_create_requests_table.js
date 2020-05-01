exports.up = function(knex) {
  let createQuery = `CREATE TABLE IF NOT EXISTS requests (
    request_id SERIAL PRIMARY KEY,
    organization_name VARCHAR(255),
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    number INT,
    picked_up BOOLEAN
  )`
  return knex.raw(createQuery)
};

exports.down = function(knex) {
  let dropQuery = `DROP TABLE requests`
  return knex.raw(dropQuery)
};