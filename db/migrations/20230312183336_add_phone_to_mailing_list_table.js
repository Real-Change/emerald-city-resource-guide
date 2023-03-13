exports.up = function(knex) {
  return knex.schema.table('mailing_list', function (table) {
    table.string('phone', 255);
  });
};

exports.down = function(knex) {
  return knex.schema.table('mailing_list', function (table) {
    table.dropColumn('phone');
  });
};
