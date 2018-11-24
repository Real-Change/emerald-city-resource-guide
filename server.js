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
app.post('/', function (req, res) {
  res.render('./pages/index.ejs');
})

//Catches

app.listen(PORT, () => console.log(`Listening on ${PORT}`));


// Method to render results
function getOrgs (request, response) {
  let SQL = 'SELECT * FROM organization;';

  return client.query(SQL)
    .then(results => response.render('./pages/results.ejs', { results: results.rows }))
    .catch(handleError);
}

//Error handling
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}





