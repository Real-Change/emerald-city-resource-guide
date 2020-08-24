
exports.up = function(knex) {
  return knex.schema.table('requests', function (table) {
    table.boolean('deleted').defaultTo(false);
  })
};

exports.down = function(knex) {
  return knex.schema.table('requests', function (table) {
    table.dropColumn('deleted');
  })
};
