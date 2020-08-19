const csv = require('csvjson');
const fs = require('fs');

const file = fs.readFileSync('db/seeds/data/users.csv', 'utf8');
const data = csv.toObject(file);

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('users').del()
    .then(function () {
      // Inserts seed entries
      return knex('users').insert(data);
    });
};
