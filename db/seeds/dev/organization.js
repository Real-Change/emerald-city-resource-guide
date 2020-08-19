const csv = require('csvjson');
const fs = require('fs');

const file = fs.readFileSync('db/seeds/data/organization.csv', 'utf8');
var options = {
  delimiter: ',',
  quote: '"'
};
const data = csv.toObject(file, options);

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('organization').del()
    .then(function () {
      // Inserts seed entries
      return knex('organization').insert(data);
    });
};
