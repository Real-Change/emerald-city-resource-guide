'use strict';

// load native chai functions
const expect = require('chai').expect;
const {
  makeCategoryQuery,
  makeGenderQuery,
  makeSQL,
  server,
} = require('../server.js');

after(function() {
  server.close();
});

describe('SERVER METHODS', function() {
  describe('makeCategoryQuery', function() {
    let category = [2, 3, 26];
    let expectedQuery = 'organization_x_category.category_id=2 OR organization_x_category.category_id=3 OR organization_x_category.category_id=26';
    let actual = makeCategoryQuery(category);

    it('should create a string', function() {
      expect(actual).to.be.a('string');
    });

    it('should create a portion of the SQL query to capture user category selections', function() {
      expect(actual).to.equal(expectedQuery);
    });

  });

  describe('makeGenderQuery', function() {
    let actual;
    let expectedQuery;
    let gender;

    it('should populate a query showing selection of women and no restrictions if female is selected', function() {
      gender = 'female';
      actual = makeGenderQuery(gender);
      expectedQuery = '(gender=\'women only\' OR gender=\'no restrictions\')';
      expect(actual).to.equal(expectedQuery)
    });

    it('should populate a query showing selection of men and no restrictions if male is selected', function() {
      gender = 'male';
      actual = makeGenderQuery(gender);
      expectedQuery = '(gender=\'men only\' OR gender=\'no restrictions\')';
      expect(actual).to.equal(expectedQuery);
    });

    it('should populate a query showing selection of no restrictions if anything other than male or female is selected', function() {
      gender = 'rather not say';
      actual = makeGenderQuery(gender);
      expectedQuery = "(gender='no restrictions' OR gender='men only' OR gender='women only')";
      expect(actual).to.equal(expectedQuery);
    });

  });

  describe('makeSQL', function() {
    let requestType;
    let category;
    let gender;
    let actual;
    let expectedQuery;

    it('should create a query if the user requests to see the full guide', function() {
      requestType = 'all';
      actual = makeSQL(requestType);
      expectedQuery = "SELECT o.organization_id, o.organization_name, o.website, o.phone_number, o.org_address, o.org_description, o.schedule, o.gender, o.kids, o.last_update, o.active, o.zipcode, o.contact_name, o.contact_email, o.contact_phone, o.contact_title, o.sponsorship, o.sponsorship_email, o.distribution, o.distribution_email, o.tempcovid, o.id_req, join1.category_names FROM organization o INNER JOIN ( SELECT oxc1.organization_id, oxc1.active, array_agg(join2.category_name) AS category_names FROM organization_x_category oxc1 INNER JOIN ( SELECT c.category_id, c.category_name FROM category c ) join2 ON (oxc1.category_id=join2.category_id) GROUP BY oxc1.organization_id, oxc1.active ) join1 ON ((o.organization_id=join1.organization_id) AND (o.active='t') AND (join1.active='t')) WHERE o.active='t' ORDER BY o.organization_name; ";
      expect(actual)
        .to.be.a('string')
        .and.to.equal(expectedQuery);
    });

    it('should create a query if the user requests to see organizations by keyword', function() {
      requestType = 'keyword';
      actual = makeSQL(requestType);
      expectedQuery = "SELECT o.organization_id, o.organization_name, o.website, o.phone_number, o.org_address, o.org_description, o.schedule, o.gender, o.kids, o.last_update, o.active, o.zipcode, o.contact_name, o.contact_email, o.contact_phone, o.contact_title, o.sponsorship, o.sponsorship_email, o.distribution, o.distribution_email, o.tempcovid, o.id_req, join1.category_names FROM organization o INNER JOIN ( SELECT oxc1.organization_id, oxc1.active, array_agg(join2.category_name) AS category_names FROM organization_x_category oxc1 INNER JOIN ( SELECT c.category_id, c.category_name FROM category c ) join2 ON (oxc1.category_id=join2.category_id) GROUP BY oxc1.organization_id, oxc1.active ) join1 ON ((o.organization_id=join1.organization_id) AND (o.active='t') AND (join1.active='t')) WHERE ((upper(organization_name) SIMILAR TO $1) OR (upper(website) SIMILAR TO $1) OR (phone_number SIMILAR TO $1) OR (upper(org_address) SIMILAR TO $1) OR (upper(org_description) SIMILAR TO $1)) ORDER BY o.organization_name; ";
      expect(actual)
        .to.be.a('string')
        .and.to.equal(expectedQuery);
    });

    it('should create a query if the user requests to search', function() {
      requestType = 'search';
      category = [13, 25, 9];
      gender = 'female';
      actual = makeSQL(requestType, category, gender);
      expectedQuery = "SELECT o.organization_id, o.organization_name, o.website, o.phone_number, o.org_address, o.org_description, o.schedule, o.gender, o.kids, o.last_update, o.active, o.zipcode, o.contact_name, o.contact_email, o.contact_phone, o.contact_title, o.sponsorship, o.sponsorship_email, o.distribution, o.distribution_email, o.tempcovid, o.id_req, join1.category_names FROM organization o INNER JOIN organization_x_category ON organization_x_category.organization_id = o.organization_id AND (organization_x_category.category_id=13 OR organization_x_category.category_id=25 OR organization_x_category.category_id=9) INNER JOIN ( SELECT oxc1.organization_id, oxc1.active, array_agg(join2.category_name) AS category_names FROM organization_x_category oxc1 INNER JOIN ( SELECT c.category_id, c.category_name FROM category c ) join2 ON (oxc1.category_id=join2.category_id) GROUP BY oxc1.organization_id, oxc1.active ) join1 ON ((o.organization_id=join1.organization_id) AND (o.active='t') AND (join1.active='t')) WHERE (gender='women only' OR gender=\'no restrictions\') ORDER BY o.organization_name; ";
      expect(actual)
        .to.be.a('string')
        .and.to.equal(expectedQuery);
    });
  });
})

