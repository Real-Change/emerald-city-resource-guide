'use strict';

// application dependencies
require('dotenv').config();
const express = require('express');
const pg = require('pg');
const nodemailer = require('nodemailer');
var firebase = require('firebase');
const firebaseConfig = {
  apiKey: 'AIzaSyDE2WnFpEFIYTMGuMdTJEvREj3P3K3sL5c',
  authDomain: 'emerald-city-resource-guide.firebaseapp.com',
  databaseURL: 'https://emerald-city-resource-guide.firebaseio.com',
  projectId: 'emerald-city-resource-guide',
  storageBucket: 'emerald-city-resource-guide.appspot.com',
  messagingSenderId: '162425982724'
};
require('firebase-app');
require('firebase-auth');
var admin = require('firebase-admin');

var serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://emerald-city-resource-guide.firebaseio.com"
});

// initialize Firebase
firebase.initializeApp(firebaseConfig);

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

// GET method route to render contact page
app.get('/contact', function (req, res){
  res.render('./pages/contact.ejs');
})

// GET method route to render request confirmation page
app.get('/confirmation', function(req, res){
  res.render('./pages/confirmation.ejs');
})

// GET method route to render login page
app.get('/login', checkLoginAuth);

app.post('/account', checkAccountAuth);

// GET method route to render account page
app.get('/account', checkAccountAuth);

// POST method for hardcopy request submission on contact page
app.post('/confirmation', submitRequest);

// method to submit copy requests
function submitRequest(req, res){
  console.log(req);
  let mailOptions = {
    from: req.body.email,
    to: 'erineckerman@gmail.com',
    cc: 'erineckerman@gmail.com',
    subject: '',
    text: ''
  };

  if (req.body.feedbackfield) {
    mailOptions.subject = 'Feedback on ECRG';
    mailOptions.text = `${req.body.name} (${req.body.email}) from ${req.body.organization} has submitted the following feedback via the ECRG site: ${req.body.feedbackfield}`;
  } else {
    mailOptions.subject = 'Request for copies of ECRG';
    mailOptions.text = `${req.body.name} (${req.body.email}) from ${req.body.organization} has requested ${req.body.number} resource guides. They would like to pick up the guides by ${req.body.date}.`;
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

// method to identify selected categories
function makeCategoryQuery(category) {
  // add category selection to SQL query and terminate the query with the last category in the array
  let categoryQuery = '';
  category.forEach(function (el) {
    let i = category.length - 1;
    if(el === category[i]){
      categoryQuery = categoryQuery + 'organization_x_category.category_id=' + el;
    } else {
      categoryQuery = categoryQuery + 'organization_x_category.category_id=' + el + ' OR ';
    }
  });
  return categoryQuery;
}

// method to identify selected gender
function makeGenderQuery(gender){
  let genderQuery = '';

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
  return genderQuery;
}

// method to generate SQL query
function makeSQL (requestType, category, gender){
  let SQL;
  if(requestType === 'all') {
    SQL = 'SELECT DISTINCT organization.*, array_agg(category.category_name) FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id GROUP BY organization.organization_id, organization.organization_name, organization.website, organization.phone_number, organization.org_address, organization.org_description, organization.schedule, organization.gender, organization.kids ORDER by organization.organization_name;';
  } else {
    SQL = 'SELECT DISTINCT orgs.*, array_agg(category.category_name) FROM organization AS orgs INNER JOIN organization_x_category ON orgs.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE ';

    let genderQuery = makeGenderQuery(gender);
    let categoryQuery = makeCategoryQuery(category);

    // add all the query components  into a single SQL query
    SQL = SQL + genderQuery + ' AND (' + categoryQuery + ') GROUP BY orgs.organization_id, orgs.organization_name, orgs.website, orgs.phone_number, orgs.org_address, orgs.org_description, orgs.schedule, orgs.gender, orgs.kids ORDER by orgs.organization_name;';
  }
  console.log(SQL);
  return SQL;
}

// method to render results
function getOrgs (request, response) {
  let requestType = request.body.submitbutton;
  let {gender, category} = request.body;

  let SQL = makeSQL(requestType, category, gender);

  // pass SQL query and values from request to render results
  return client.query(SQL)
    .then(results => response.render('./pages/results.ejs', { results: results.rows }))
    .catch(handleError);
}

// check for authentication
function checkLoginAuth(req, res){
  let user = firebase.auth().currentUser;
  console.log(user);
  if(user){
    res.redirect('/account');
  } else {
    res.render('./pages/auth/login.ejs')
  }
}
function checkAccountAuth(req, res){
  let user = firebase.auth().currentUser;
  console.log(user);
  if (user) {
    res.render('./pages/auth/account.ejs');
  } else {
    res.redirect('/login');
  }
}

// error handling
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// export methods for testing and authorization
module.exports = {
  makeCategoryQuery : makeCategoryQuery,
  makeGenderQuery : makeGenderQuery,
  makeSQL : makeSQL
}
