exports.up = function(knex) {
  let createQuery = `CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    lastname VARCHAR(255),
    firstname VARCHAR(255),
    email VARCHAR(255)
  )`
  return knex.raw(createQuery)
};

exports.down = function(knex) {
  let dropQuery = `DROP TABLE users`
  return knex.raw(dropQuery)
};