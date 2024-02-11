const parser = require("csv/dist/cjs/sync.cjs");
const fs = require('fs');

const file = fs.readFileSync('db/seeds/data/users.csv', 'utf8');
const data = parser.parse(file, { columns: true });

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('users').del()
    .then(function () {
      // Inserts seed entries
      return knex('users').insert(data);
    });
};
