'use strict';

// Application Dependencies
const express = require('express');
const pg = require('pg');

// Application Setup
const app = express();
const PORT = process.env.PORT || 8080;

// Application Middleware
app.use(express.static('./public'));
app.use(express.urlencoded({extended: true}));

const client = new pg.Client('postgres://localhost:5432/emerald');
client.connect();
client.on('error', err => console.log(err));

// Set the view engine for server-side templating
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


//Catches

app.listen(PORT, () => console.log(`Listening on ${PORT}`));


// Method to render results
function getOrgs (request, response) {

  let {gender, kids} = request.body;

  //return all orgs that fit gender selection
  let SQL = 'SELECT * FROM organization WHERE kids=$1';
  let genderQuery = '';
  let values = [kids];

  switch(gender){
  case 'female':
    genderQuery = "gender='women only' OR gender='no restrictions'";
    break;
  case 'male':
    genderQuery = "gender='men only' OR gender='no restrictions'";
    break;
  default:
    genderQuery = "gender='no restrictions'";
  }

  SQL = SQL + ' AND ' + genderQuery + ';';

  //return all orgs in selected categories
  // let SQL = 'SELECT organization_id, organization_name, website, phone_number, org_address, org_description, schedule, gender, kids FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id WHERE organization_x_category.category_id == ;';

  //Return all orgs
  // let SQL = 'SELECT * FROM organization;';
  debugger;


  return client.query(SQL, values)
    .then(results => response.render('./pages/results.ejs', { results: results.rows }))
    .catch(handleError);
}

//Error handling
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}






