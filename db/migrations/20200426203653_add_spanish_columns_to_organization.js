
exports.up = function(knex) {
  return knex.schema.table('organization', function (table) {
    table.text('org_description_es');
    table.text('org_address_es');
    table.text('schedule_es');
  })
};

exports.down = function(knex) {
  return knex.schema.table('organization', function (table) {
    table.dropColumn('org_description_es');
    table.dropColumn('org_address_es');
    table.dropColumn('schedule_es');
  })
};
