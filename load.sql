COPY organization(organization_name, website, phone_number, org_address, org_description, schedule, gender, kids, active, zipcode, last_update) FROM '/Users/erineckerman/projects/emerald-city-resource-guide/organization.csv' DELIMITER ',' CSV HEADER;

COPY category(category_id, category_name) FROM '/Users/erineckerman/projects/emerald-city-resource-guide/category.csv' DELIMITER ',' CSV HEADER;

COPY organization_x_category(organization_id, category_id, active) FROM '/Users/erineckerman/projects/emerald-city-resource-guide/organization_x_category.csv' DELIMITER ',' CSV HEADER;

COPY users(lastname, firstname, email) FROM '/Users/erineckerman/projects/emerald-city-resource-guide/users.csv' DELIMITER ',' CSV HEADER;

COPY requests(request_id, organization_name, contact_name, email, phone, number, picked_up) from 'requests.csv' DELIMITER ',' CSV HEADER;

UPDATE organization
SET organization_name = REPLACE(organization_name, '\', ''),
phone_number = REPLACE(phone_number, '\', ''),
org_address = REPLACE(org_address, '\', ''),
org_description = REPLACE(org_description, '\', ''),
schedule = REPLACE(schedule, '\', '');