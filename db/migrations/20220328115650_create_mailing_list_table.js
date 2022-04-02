

exports.up = function(knex) {
    return knex.schema.createTable('mailing_list', function (table) {
        table.increments('mailing_list_id');
        table.string('organization_name', 255);
        table.string('contact_name', 255);
        table.string('email', 255);
        table.timestamp('date').defaultTo(knex.fn.now());
      })
  };
  
exports.down = function(knex) {
    return knex.schema.dropTableIfExists('mailing_list');
  };
