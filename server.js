'use strict';

// application dependencies
require('dotenv').config();
const express = require('express');
const pg = require('pg');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
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

// var serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

// initialize Firebase
firebase.initializeApp(firebaseConfig);
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'https://emerald-city-resource-guide.firebaseio.com'
// });

// application setup
const app = express();
const PORT = process.env.PORT || 8080;

// application middleware
app.use(express.static('./public'));
app.use(express.urlencoded({
  extended: true
}));
app.use(cookieParser());
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2']
}))

const client = new pg.Client(process.env.DATABASE_URL);
client.connect()
  .catch(e => console.error('connection error', e.stack));
client.on('error', err => console.log(err));

// set the view engine for server-side templating
app.set('view engine', 'ejs');
app.post('/results', getOrgs);

// GET method route to render form page
app.get('/', function(req, res) {
  res.render('./pages/index.ejs');
})

// GET method route to render contact page
app.get('/contact', function(req, res) {
  res.render('./pages/contact.ejs');
})

// GET method route to render request confirmation page
app.get('/confirmation', function(req, res) {
  res.render('./pages/confirmation.ejs');
})

// GET method route to render login page
app.get('/login', function(req, res) {
  res.render('./pages/auth/login.ejs');
});


// POST method for hardcopy request submission on contact page
app.post('/confirmation', submitRequest);

// method to submit copy requests
function submitRequest(req, res) {
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
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    service: 'Gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
  transporter.verify(function(err, success) {
    if (err) {
      console.log(err);
    } else {
      console.log(success);
    }
  })
  transporter.sendMail(mailOptions, function(err, info) {
    if (err) {
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
  category.forEach(function(el) {
    let i = category.length - 1;
    if (el === category[i]) {
      categoryQuery = categoryQuery + 'organization_x_category.category_id=' + el;
    } else {
      categoryQuery = categoryQuery + 'organization_x_category.category_id=' + el + ' OR ';
    }
  });
  return categoryQuery;
}

// method to identify selected gender
function makeGenderQuery(gender) {
  let genderQuery = '';

  // add gender selection to SQL query
  switch (gender) {
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
function makeSQL(requestType, category, gender) {
  let SQL;
  if (requestType === 'all') {
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
function getOrgs(request, response) {
  let requestType = request.body.submitbutton;
  let {gender, category} = request.body;

  let SQL = makeSQL(requestType, category, gender);

  // pass SQL query and values from request to render results
  return client.query(SQL)
    .then(results => response.render('./pages/results.ejs', {
      results: results.rows
    }))
    .catch(handleError);
}

// error handling
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// export methods for testing and authorization
module.exports = {
  makeCategoryQuery: makeCategoryQuery,
  makeGenderQuery: makeGenderQuery,
  makeSQL: makeSQL
}

app.post('/sessionLogin', (req, res) => {
  // Get the ID token passed and the CSRF token.
  const idToken = req.body.idToken.toString();

  // Set session expiration to 5 days.
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  // Create the session cookie. This will also verify the ID token in the process.
  // The session cookie will have the same claims as the ID token.
  // To only allow session cookie setting on recent sign-in, auth_time in ID token
  // can be checked to ensure user was recently signed in before creating a session cookie.
  admin.auth().verifyIdToken(idToken)
    .then((decodedIdToken) => {
      let userEmail = decodedIdToken.email;
      let SQL = 'SELECT * FROM users WHERE email = \'' + userEmail + '\';';

      return(client.query(SQL))
        .then((results)=> {
          if (results.rowCount > 0 ){
            // Create session cookie and set it.
            admin.auth().createSessionCookie(idToken, {
              expiresIn
            })
              .then((sessionCookie) => {
                // Set cookie policy for session cookie.
                const options = {
                  maxAge: expiresIn,
                  httpOnly: true,
                  secure: false
                };
                res.cookie('session', sessionCookie, options);
                res.end(JSON.stringify({
                  status: 'success'
                }))
              })
              .catch(error => {
                res.status(401).send('UNAUTHORIZED REQUEST!', error);
              });
          } else {
            // res.redirect('/login');
          }
        })
    })
    .catch(error => {
      res.status(401).send(error);
    });

});


// Whenever a user is accessing restricted content that requires authentication.

app.get('/sessionConfirmation', (req, res) => {
  const sessionCookie = req.cookies.session || '';
  console.log('your session cookie is:      \'' + sessionCookie + '\'');
  // Verify the session cookie. In this case an additional check is added to detect
  // if the user's Firebase session was revoked, user deleted/disabled, etc.
  admin.auth().verifySessionCookie(
    sessionCookie, true /** checkRevoked */ )
    .then(() => {
      res.redirect('/account');
    })
    .catch(error => {
      console.log('verification error', error);
      // Session cookie is unavailable or invalid. Force user to login.
      // res.redirect('/login');
      console.log('forced back to login')
    });
});

// Render account page if authorized

app.get('/account', (req, res) => {
  if(req.cookies.session !== undefined){
    console.log('good jorb');
    res.render('./pages/auth/account.ejs')
  } else {
    console.log('not so fast');
    // res.redirect('/login')
  }
})

// Sign out user by clearing cookie and redirecting
app.post('/sessionLogout', (req, res) => {
  firebase.auth().signOut().then(function() {
    res.clearCookie('session');
    res.redirect('/login')
  }).catch(function(error) {
    console.log('sign out error:  ', error)
  });
});

app.post('/:searchTerm', returnAdminResults);
// app.get('/:searchTerm', returnAdminResults);

function returnAdminResults(req, res){
  let searchTerm = ((req.body.searchbar).trim()).split(' ');
  console.log('SEARCH TERM:   ', searchTerm[0]);
  let SQL;
  let searchInput;

  if(searchTerm.length === 1){
    searchInput = searchTerm[0].toUpperCase();
    SQL= 'SELECT * FROM organization WHERE upper(organization_name) LIKE \'%' + searchInput + '%\' OR upper(website) LIKE \'%' + searchInput + '%\' OR phone_number LIKE \'%' + searchInput + '%\' OR upper(org_address) LIKE \'%' + searchInput + '%\' OR upper(org_description) LIKE \'%' + searchInput + '%\' ORDER BY organization_name;';
    console.log('SQL   :', SQL);
  } else {
    searchInput = (searchTerm.join('')).toUpperCase();
    SQL = 'SELECT * FROM organization WHERE organization_name LIKE \'%' + searchTerm + '%\' OR website LIKE \'%' + searchTerm + '%\' OR phone_number LIKE \'%' + searchTerm + '%\' OR org_address LIKE \'%' + searchTerm + '%\' OR org_description LIKE \'%' + searchTerm + '%\' ORDER BY organization_name;';
  }
  
  return client.query(SQL)
    .then(result => res.render('./pages/auth/search-admin-results', { results: result.rows }))
    .catch(error => handleError(error, res));
}

app.post('/update/:orgId', editOrg);

function editOrg(req, res){
  let orgId = req.params.orgId;
  let SQL = 'SELECT DISTINCT * from organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id WHERE organization.organization_id=' + orgId + ';';

  client.query(SQL)
    .then(result => res.render('./pages/auth/org-edit', {results: result.rows[0]}))
    .catch(error => handleError(error, res));
}

