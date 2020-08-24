const csv = require('csvjson');
const fs = require('fs');

const file = fs.readFileSync('db/seeds/data/requests.csv', 'utf8');

var options = {
  delimiter : ',',
  quote     : '"'
};
const data = csv.toObject(file, options);

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('requests').del()
    .then(function () {
      // Inserts seed entries
      return knex('requests').insert(data);
    });
};
