const csv = require('csvjson');
const fs = require('fs');

const file = fs.readFileSync('db/seeds/data/organization_x_category.csv', 'utf8');
const data = csv.toObject(file);

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('organization_x_category').del()
    .then(function () {
      // Inserts seed entries
      return knex('organization_x_category').insert(data);
    });
};
