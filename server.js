'use strict';

// application dependencies
require('dotenv').config();
const express = require('express');
const pg = require('pg');
const nodemailer = require('nodemailer');

// application setup
const app = express();
const PORT = process.env.PORT || 8080;

// application middleware
app.use(express.static('./public'));
app.use(express.urlencoded({extended: true}));

const client = new pg.Client(process.env.DATABASE_URL);
client.connect()
  .catch(e => console.error('connection error', e.stack));
client.on('error', err => console.log(err));

// set the view engine for server-side templating
app.set('view engine', 'ejs');
app.post('/results', getOrgs);

// GET method route to render form page
app.get('/', function (req, res) {
  res.render('./pages/index.ejs');
})

// POST method route to render form page
let formContents = [];

app.post('/', function (req, res) {
  res.render('./pages/index.ejs');
  formContents = req;
  console.log(formContents);
})

// GET method route to render contact page
app.get('/contact', function (req, res){
  res.render('./pages/contact.ejs');
})

// POST method route to render contact page
app.post('/contact', function(req, res){
  res.render('./pages/contact.ejs');
})

// GET method route to render request confirmation page
app.get('/confirmation', function(req, res){
  res.render('./pages/confirmation.ejs');
})

// POST method for hardcopy request submission on contact page
app.post('/confirmation', submitRequest);

// method to submit copy requests
function submitRequest(req, res){
  let mailOptions;
  if (req.body.feedbackfield) {
    mailOptions = {
      from: req.body.email,
      to: 'resourceguide@realchangenews.org',
      cc: 'erineckerman@gmail.com',
      subject: 'Feedback on ECRG',
      text: `${req.body.name} (${req.body.email}) from ${req.body.organization} has submitted the following feedback via the ECRG site: ${req.body.feedbackfield}`
    }
  } else {
    mailOptions = {
      from: req.body.email,
      to: 'resourceguide@realchangenews.org',
      cc: 'erineckerman@gmail.com',
      subject: 'Request for copies of ECRG',
      text: `${req.body.name} (${req.body.email}) from ${req.body.organization} has requested ${req.body.number} resource guides. They would like to pick up the guides by ${req.body.date}.`
    };
  }

  let transporter = nodemailer.createTransport({
    host:'smtp.gmail.com',
    port: 465,
    secure: true,
    service: 'Gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
  transporter.verify(function(err, success){
    if(err) {
      console.log(err);
    } else {
      console.log(success);
    }
  })
  transporter.sendMail(mailOptions, function (err, info){
    if(err) {
      console.log(err);
    } else {
      console.log(info);
    }
  })
  res.render('./pages/confirmation.ejs')
}

// catches
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// method to render results
function getOrgs (request, response) {
  let requestType = request.body.submitbutton;
  let SQL;
  if(requestType === 'all') {
    SQL = 'SELECT DISTINCT organization.*, array_agg(category.category_name) FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id GROUP BY organization.organization_id, organization.organization_name, organization.website, organization.phone_number, organization.org_address, organization.org_description, organization.schedule, organization.gender, organization.kids ORDER by organization.organization_name;';
  } else {
    let {gender, category} = request.body;
    SQL = 'SELECT DISTINCT orgs.*, array_agg(category.category_name) FROM organization AS orgs INNER JOIN organization_x_category ON orgs.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE ';
    let genderQuery = '';
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
    SQL = SQL + genderQuery + ' AND (' + categoryQuery + ') GROUP BY orgs.organization_id, orgs.organization_name, orgs.website, orgs.phone_number, orgs.org_address, orgs.org_description, orgs.schedule, orgs.gender, orgs.kids ORDER by orgs.organization_name;';
  }

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

