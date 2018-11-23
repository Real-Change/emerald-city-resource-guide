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

// Routing Options
// GET method route
app.get('/', function (req, res) {
  res.render('./pages/index.ejs');
})

// POST method route
app.post('/', function (req, res) {
  res.render('./pages/index.ejs');
})

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

//Error Handling
function handleError (error, response) {
  console.error(error);
  if (response) response.status(500).send('Sorry something went wrong');
}





