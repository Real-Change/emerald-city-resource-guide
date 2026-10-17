"use strict";

const ORGANIZATION_EXPORT_SQL = `
    SELECT
      o.organization_id,
      o.organization_name,
      o.website,
      o.phone_number,
      o.org_address,
      o.org_description,
      o.schedule,
      o.gender,
      o.kids,
      o.active::text,
      o.last_update::text,
      o.zipcode,
      o.contact_name,
      o.contact_email,
      o.contact_phone,
      o.contact_title,
      o.sponsorship::text,
      o.distribution::text,
      o.id_req::text,
      o.sponsorship_email,
      o.distribution_email,
      o.org_description_es,
      o.org_address_es,
      o.schedule_es,
      join2.print_locations

    FROM organization o
    LEFT OUTER JOIN (
      SELECT oxc2.organization_id, oxc2.active, oxc2.print_location, ARRAY_AGG(c.category_name) AS print_locations
      FROM organization_x_category oxc2
      LEFT JOIN category c ON (oxc2.category_id = c.category_id)
      GROUP BY oxc2.organization_id, oxc2.active, oxc2.print_location
    ) join2 ON ((o.organization_id = join2.organization_id) AND join2.active='t' AND join2.print_location='t')
  `;

module.exports = {
  ORGANIZATION_EXPORT_SQL: ORGANIZATION_EXPORT_SQL,
};
