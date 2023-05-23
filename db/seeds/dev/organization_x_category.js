const parser = require("csv/dist/cjs/sync.cjs");
const fs = require('fs');

const file = fs.readFileSync('db/seeds/data/organization_x_category.csv', 'utf8');
const data = parser.parse(file, { columns: true });

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('organization_x_category').del()
    .then(function () {
      // Inserts seed entries
      return knex('organization_x_category').insert(data);
    });
};
