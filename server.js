'use strict';

// application dependencies
const express = require('express');
const pg = require('pg');

// application setup
const app = express();
const PORT = process.env.PORT || 8080;

// application middleware
app.use(express.static('./public'));
app.use(express.urlencoded({extended: true}));

const client = new pg.Client('postgres://localhost:5432/emerald');
client.connect();
client.on('error', err => console.log(err));

// set the view engine for server-side templating
app.set('view engine', 'ejs');
app.post('/results', getOrgs);

// GET method route to render form page
app.get('/', function (req, res) {
  res.render('./pages/index.ejs');
})

// POST method route to render form page
let formContents= [];

app.post('/', function (req, res) {
  res.render('./pages/index.ejs');
  formContents = req;
  console.log(formContents);
})

// catches
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// method to render results
function getOrgs (request, response) {

  let {gender, kids, category} = request.body;

  let SQL = 'SELECT DISTINCT orgs.* FROM organization as orgs INNER JOIN organization_x_category ON orgs.organization_id=organization_x_category.organization_id WHERE ';
  let genderQuery = '';
  let kidsQuery = '';
  let categoryQuery = '';

  // add gender selection to SQL query
  switch(gender){
  case 'female':
    genderQuery = '(gender=\'women only\' OR gender=\'no restrictions\')';
    break;
  case 'male':
    genderQuery = '(gender=\'men only\' OR gender=\'no restrictions\')';
    break;
  default:
    genderQuery = 'gender=\'no restrictions\'';
  }

  // add child selection to SQL query
  switch(kids) {
  case 'yes':
    kidsQuery = 'kids=\'allowed\'';
    break;
  default:
    kidsQuery = 'kids=\'not allowed\' OR kids=\'allowed\'';
  }

  // add category selection to SQL query and terminate the query with the last category in the array
  category.forEach(el => { 
    let i = category.length - 1;
    if(el === category[i]){
      categoryQuery = categoryQuery + 'organization_x_category.category_id=' + el;
    } else {
      categoryQuery = categoryQuery + 'organization_x_category.category_id=' + el + ' OR ';
    }
  });

  // add all the query components  into a single SQL query
  SQL = SQL + genderQuery + ' AND ' + kidsQuery + ' AND (' + categoryQuery + ') ORDER by organization_name;';

  // pass SQL query and values from request to render results
  return client.query(SQL)
    .then(results => response.render('./pages/results.ejs', { results: results.rows }))
    .catch(handleError);
}

// error handling
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

