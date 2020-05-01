exports.up = function(knex) {
  let createQuery = `CREATE TABLE IF NOT EXISTS organization ( 
    organization_id SERIAL PRIMARY KEY, 
    organization_name VARCHAR(255),
    website VARCHAR(255),
    phone_number VARCHAR(1024),
    org_address VARCHAR(1024),
    org_description VARCHAR(2000),
    schedule VARCHAR(1024),
    gender VARCHAR(64),
    kids VARCHAR(64),
    active BOOLEAN,
    last_update TIMESTAMPTZ,
    zipcode INT,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    contact_title VARCHAR(255),
    sponsorship BOOLEAN,
    distribution BOOLEAN,
    id_req BOOLEAN,
    sponsorship_email VARCHAR(255),
    distribution_email VARCHAR(255)
  )`
  return knex.raw(createQuery)
};

exports.down = function(knex) {
  let dropQuery = `DROP TABLE organization`
  return knex.raw(dropQuery)
};
