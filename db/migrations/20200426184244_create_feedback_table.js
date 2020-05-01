exports.up = function(knex) {
  let createQuery = `CREATE TABLE IF NOT EXISTS feedback (
    feedback_id SERIAL PRIMARY KEY,
    org_name VARCHAR(50),
    contact_name VARCHAR(100),
    contact_email VARCHAR(100),
    message VARCHAR(255),
    date VARCHAR(50)
  )`
  return knex.raw(createQuery)
};

exports.down = function(knex) {
  let dropQuery = `DROP TABLE feedback`
  return knex.raw(dropQuery)
};