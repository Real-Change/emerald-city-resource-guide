exports.up = function(knex) {
  let createQuery = `CREATE TABLE IF NOT EXISTS category (
    category_id INT,
    category_name VARCHAR(255)
  )`
  return knex.raw(createQuery)
};

exports.down = function(knex) {
  let dropQuery = `DROP TABLE category`
  return knex.raw(dropQuery)
};