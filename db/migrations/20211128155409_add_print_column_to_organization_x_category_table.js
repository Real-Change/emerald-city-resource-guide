

exports.up = function(knex) {
    return knex.schema.table('organization_x_category', function (table) {
        table.boolean('print_location').defaultTo(false);
      })
};

exports.down = function(knex) {
    return knex.schema.hasColumn('organization_x_category', 'print_location').then(exists => {
        if (exists) {
            return knex.schema.table('organization_x_category', function (table) {
                table.dropColumn('print_location');
            });
        };
    });
};
