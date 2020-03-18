DROP TABLE IF EXISTS organization;
DROP TABLE IF EXISTS organization_x_category;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS feedback;


CREATE TABLE IF NOT EXISTS organization ( 
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
);

CREATE TABLE IF NOT EXISTS organization_x_category (
  match_id SERIAL PRIMARY KEY,
  organization_id INT,
  category_id INT,
  active BOOLEAN
);

CREATE TABLE IF NOT EXISTS category (
  category_id INT,
  category_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  lastname VARCHAR(255),
  firstname VARCHAR(255),
  email VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS requests (
  request_id SERIAL PRIMARY KEY,
  organization_name VARCHAR(255),
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(255),
  number INT,
  picked_up BOOLEAN
);

CREATE TABLE IF NOT EXISTS feedback (
  feedback_id SERIAL PRIMARY KEY,
  org_name VARCHAR(50),
  contact_name VARCHAR(100),
  contact_email VARCHAR(100),
  message VARCHAR(255),
  date VARCHAR(50)
);
