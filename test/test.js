'use strict';

// load native chai functions
let expect = require('chai').expect;

describe('SERVER METHODS', function() {
  describe('makeCategoryQuery', function() {
    let makeCategoryQuery = require('../server.js').makeCategoryQuery;
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
    let makeGenderQuery = require('../server.js').makeGenderQuery;
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
      expectedQuery = 'gender=\'no restrictions\'';
      expect(actual).to.equal(expectedQuery);
    });

  });

  describe('makeSQL', function() {
    let makeSQL = require('../server.js').makeSQL;
    let requestType;
    let category;
    let gender;
    let actual;
    let expectedQuery;

    it('should create a string if the user requests to see the full guide', function() {
      requestType = 'all';
      actual = makeSQL(requestType);
      expect(actual).to.be.a('string');
    });

    it('should populate a query to retrieve all records from the organization table if the user requests to see the full guide', function() {
      requestType = 'all';
      actual = makeSQL(requestType);
      expectedQuery = 'SELECT DISTINCT organization.*, array_agg(category.category_name) FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id GROUP BY organization.organization_id, organization.organization_name, organization.website, organization.phone_number, organization.org_address, organization.org_description, organization.schedule, organization.gender, organization.kids ORDER by organization.organization_name;';
      expect(actual).to.equal(expectedQuery);
    });

    requestType = 'search';
    category = [13, 25, 9];
    gender = 'female';
    expectedQuery = 'SELECT DISTINCT orgs.*, array_agg(category.category_name) FROM organization AS orgs INNER JOIN organization_x_category ON orgs.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE (gender=\'women only\' OR gender=\'no restrictions\') AND (organization_x_category.category_id=13 OR organization_x_category.category_id=25 OR organization_x_category.category_id=9) GROUP BY orgs.organization_id, orgs.organization_name, orgs.website, orgs.phone_number, orgs.org_address, orgs.org_description, orgs.schedule, orgs.gender, orgs.kids ORDER by orgs.organization_name;';

    it('should create a string if the user performs a search', function() {
      expect(actual).to.be.a('string');
    });

    it('should create a SQL query matching the user selections', function() {
      expect(actual).to.equal(expectedQuery);
    })
  });
})

