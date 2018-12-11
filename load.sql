COPY organization(organization_id, organization_name, website, phone_number, org_address, org_description, schedule, gender, kids) FROM '/Users/erin/projects/emerald-city-resource-guide/organization.csv' DELIMITER ',' CSV HEADER;

COPY category(category_id, category_name) FROM '/Users/erin/projects/emerald-city-resource-guide/category.csv' DELIMITER ',' CSV HEADER;

COPY organization_x_category(match_id, organization_id, category_id) FROM '/Users/erin/projects/emerald-city-resource-guide/organization_x_category.csv' DELIMITER ',' CSV HEADER;

UPDATE organization
SET organization_name = REPLACE(organization_name, '\', ''),
phone_number = REPLACE(phone_number, '\', ''),
org_address = REPLACE(org_address, '\', ''),
org_description = REPLACE(org_description, '\', ''),
schedule = REPLACE(schedule, '\', '');

