const parser = require("csv/dist/cjs/sync.cjs");
const fs = require('fs');

const file = fs.readFileSync('db/seeds/data/category.csv', 'utf8');
const data = parser.parse(file, { columns: true });

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('category').del()
    .then(function () {
      // Inserts seed entries
      return knex('category').insert(data);
    });
};
