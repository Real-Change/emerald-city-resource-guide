const parser = require("csv/dist/cjs/sync.cjs");
const fs = require('fs');

const file = fs.readFileSync('db/seeds/data/organization.csv', 'utf8');
const data = parser.parse(file, { columns: true });

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('organization').del()
    .then(function () {
      // Inserts seed entries
      return knex('organization').insert(data);
    });
};
