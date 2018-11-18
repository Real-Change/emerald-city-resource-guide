'use strict';

// Application Dependencies
const express = require('express');
const pg = require('pg');

// Application Setup
const app = express();
const PORT = process.env.PORT || 3000;

// Application Middleware
app.use(express.static('./public'));
app.use(express.urlencoded({extended: true}));

const client = new pg.Client(`${process.env.PORT}`);
client.connect();
client.on('error', err => console.log(err));

// Set the view engine for server-side templating
app.set('view engine', 'ejs');

app.get('*', (request, response) => response.status(404).send('This route does not exist'));
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// Routing Options



//Error Handling
function handleError (error, response) {
  console.error(error);
  if (response) response.status(500).send('Sorry something went wrong');
}





