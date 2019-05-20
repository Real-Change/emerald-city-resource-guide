'use strict';

// application dependencies
require('dotenv').config();
const express = require('express');
const pg = require('pg');
const methodOverride = require('method-override');
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
const admin = require('firebase-admin');

const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

// initialize Firebase
firebase.initializeApp(firebaseConfig);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://emerald-city-resource-guide.firebaseio.com'
});


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

app.use(methodOverride((request) => {
  if (request.body && typeof request.body === 'object' && '_method' in request.body) {
    let method = request.body._method;
    delete request.body._method;
    return method;
  }
}));

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
    SQL = 'SELECT DISTINCT organization.*, array_agg(category.category_name) FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE organization.active=\'t\' GROUP BY organization.organization_id, organization.organization_name, organization.website, organization.phone_number, organization.org_address, organization.org_description, organization.schedule, organization.gender, organization.kids, organization.last_update, organization.active, organization.zipcode ORDER by organization.organization_name;';
  } else {
    SQL = 'SELECT DISTINCT orgs.*, array_agg(category.category_name) FROM organization AS orgs INNER JOIN organization_x_category ON orgs.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE ';

    let genderQuery = makeGenderQuery(gender);
    let categoryQuery = makeCategoryQuery(category);

    // add all the query components  into a single SQL query
    SQL = SQL + genderQuery + ' AND (' + categoryQuery + ') AND (organization_x_category.active=\'t\') AND (orgs.active=\'t\') GROUP BY orgs.organization_id, orgs.organization_name, orgs.website, orgs.phone_number, orgs.org_address, orgs.org_description, orgs.schedule, orgs.gender, orgs.kids, orgs.last_update, orgs.active, orgs.zipcode ORDER by orgs.organization_name;';
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

// Function to call in every admin page to verify permissions
function verifyPerms(req, res, page){
  let userEmail = req.cookies.user || '';
  let SQL = 'SELECT * FROM users WHERE email=\'' + userEmail +'\';';
  return(client.query(SQL))
    .then((results) => {
      if(results.rowCount > 0){
        res.render(page);
      } else {
        alert('You do not have permission to view this page.');
        res.redirect('/login')
      }
    })
    .catch(handleError)
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
                res.cookie('user', userEmail, options);
                res.end(JSON.stringify({
                  status: 'success'
                }))
              })
              .catch(error => {
                res.status(401).send('UNAUTHORIZED REQUEST!', error);
              });
          } else {
            res.redirect('/login');
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
      res.redirect('/admin/account');
    })
    .catch(error => {
      console.log('verification error', error);
      // Session cookie is unavailable or invalid. Force user to login.
      res.redirect('/login');
      console.log('forced back to login')
    });
});

// Render account page if authorized

app.get('/admin/account', (req, res) => {
  if(req.cookies.session !== undefined){
    verifyPerms(req, res, './pages/auth/account.ejs')
  } else {
    res.redirect('/login')
  }
})

// Sign out user by clearing cookie and redirecting
app.post('/sessionLogout', (req, res) => {
  const sessionCookie = req.cookies.session || '';
  res.clearCookie('user');
  res.clearCookie('session');
  admin.auth().verifySessionCookie(sessionCookie)
    .then((decodedClaims) => {
      return admin.auth().revokeRefreshTokens(decodedClaims.sub);
    })
    .then(() => {
      res.redirect('/login');
    })
    .catch((error) => {
      res.redirect('/login');
    });
});


app.post('/admin/:searchTerm', returnAdminResults);

function returnAdminResults(req, res){
  console.log('Admin search results req:   ', req.body)
  let searchTerm = ((req.body.searchbar).trim()).split(' ');
  console.log('SEARCH TERM ****', searchTerm);
  let searchInput;
  let SQL;

  if(searchTerm.length === 1){
    searchInput = '\'%' + (searchTerm[0].toUpperCase()) + '%\'';
    SQL = 'SELECT DISTINCT * FROM organization WHERE active=\'t\' AND ((upper(organization_name) LIKE '+ searchInput + ') OR (upper(website) LIKE ' + searchInput + ') OR (phone_number LIKE '+ searchInput + ') OR (upper(org_address) LIKE ' + searchInput + ') OR (upper(org_description) LIKE ' + searchInput + ')) ORDER BY organization_name;';
    console.log(SQL);
  } else {
    let nameInput = '(upper(organization_name) LIKE ';
    let websiteInput = '(upper(website) LIKE ';
    let phoneInput = '(phone_number LIKE ';
    let addressInput = '(upper(org_address) LIKE ';
    let descInput = '(upper(org_description) LIKE ';
    searchTerm.forEach(function(el) {
      let i = searchTerm.indexOf(el);
      searchInput = '\'%' + (searchTerm[i].toUpperCase()) + '%\'';
      if ( i === 0){
        nameInput = nameInput + searchInput + ' OR ';
        websiteInput = websiteInput + searchInput + ' OR ';
        phoneInput = phoneInput + searchInput + ' OR ';
        addressInput = addressInput + searchInput + ' OR ';
        descInput = descInput + searchInput + ' OR ';
      } else if (i < (searchTerm.length - 1)) {
        nameInput = nameInput + 'upper(organization_name) LIKE ' + searchInput + ' OR ';
        websiteInput = websiteInput + 'upper(website) LIKE ' + searchInput + ' OR ';
        phoneInput = phoneInput + 'phone_number LIKE ' + searchInput + ' OR ';
        addressInput = addressInput + 'upper(org_address) LIKE ' + searchInput + ' OR ';
        descInput = descInput + 'upper(org_description) LIKE ' + searchInput + ' OR ';
      } else {
        nameInput = nameInput + 'upper(organization_name) LIKE ' + searchInput + ')';
        websiteInput = websiteInput + 'upper(website) LIKE ' + searchInput + ')';
        phoneInput = phoneInput + 'phone_number LIKE ' + searchInput + ')';
        addressInput = addressInput + 'upper(org_address) LIKE ' + searchInput + ')';
        descInput = descInput + 'upper(org_description) LIKE ' + searchInput + ')';
      }
    });
    SQL = 'SELECT * FROM organization WHERE ' + nameInput + ' OR ' + websiteInput + ' OR ' + phoneInput + ' OR ' + addressInput + ' OR ' + descInput + ' ORDER BY organization_name;';
    console.log(SQL);
  }
  return client.query(SQL)
    .then(result => res.render('./pages/auth/search-admin-results', { results: result.rows }))
    .catch(error => handleError(error, res));
}

app.post('/admin/update/:orgId', editOrg);

function editOrg(req, res){
  let orgId = req.params.orgId;
  let SQL = 'SELECT DISTINCT organization.*, array_agg(DISTINCT(category.category_id)) FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE (organization.organization_id=' + orgId + ' AND organization_x_category.active=\'t\') GROUP BY organization.organization_id, organization.organization_name, organization.website, organization.phone_number, organization.org_address, organization.org_description, organization.schedule, organization.gender, organization.kids, organization.last_update, organization.active, organization.zipcode ORDER by organization.organization_name;'

  client.query(SQL)
    .then(result => res.render('./pages/auth/org-edit', {results: result.rows[0]}))
    .catch(handleError);
}

// Submit and confirm record edits

app.put('/admin/editconfirmation', function (req, res) {
  // Map form updates into SQL query for organization table
  let organization_id = req.body.id;
  let organization_name = req.body.name;
  let website = (req.body.website).trim();
  let phone_number = req.body.phone_number;
  let org_address = req.body.org_address;
  let org_description = req.body.org_description;
  let schedule = req.body.schedule;
  let gender = req.body.gender;
  let timestamp = req.body.timestamp
  let mainSQL = 'UPDATE organization SET organization_name=\''+ organization_name + '\', website=\'' + website + '\', phone_number=\''+ phone_number +'\', org_address=\''+ org_address +'\', org_description=\'' + org_description + '\', schedule=\'' + schedule + '\', gender=\'' + gender + '\', last_update=\'' + timestamp+ '\' WHERE organization_id=' + organization_id + ' RETURNING organization_name;';

  //Create SQL queries to remove and add categories for an organization
  let catsArray = compareCategories(req);
  let catsToRemove = catsArray[1];
  let catsToAdd = catsArray[0];

  let category_remove_id = 'category_id=';
  let category_add_id = '(';
  let catRemoveSQL;
  let catAddSQL;

  if(catsToRemove.length <1){
    catRemoveSQL = '';
  } else {
    for(let i=0; i<catsToRemove.length; i++){
      if (catsToRemove.length === 1) {
        category_remove_id = category_remove_id + catsToRemove[i];
      } else if (i=== 0){
        category_remove_id = category_remove_id + catsToRemove[i] + ' OR ';
      } else if(i === (catsToRemove.length - 1)){
        category_remove_id = category_remove_id + 'category_id=' + catsToRemove[i];
      } else {
        category_remove_id = category_remove_id + 'category_id=' + catsToRemove[i] + ' OR ';
      }
    }
    catRemoveSQL = 'UPDATE organization_x_category SET active=\'false\' WHERE organization_id=' + organization_id + ' AND (' + category_remove_id + ');';
  }
  
  if(catsToAdd.length <1){
    catAddSQL='';
  } else {
    for (let i=0; i<catsToAdd.length; i++){
      if (catsToAdd.length === 1) {
        category_add_id = category_add_id + organization_id + ',' + catsToAdd[i] + ',' + 'true)'
      } else if(i === 0){
        category_add_id = category_add_id + organization_id + ',' + catsToAdd[i] + ',' + 'true), '
      } else if(i === (catsToAdd.length -1)){
        category_add_id = category_add_id + '(' + organization_id + ',' + catsToAdd[i] + ',' + 'true)';
      } else {
        category_add_id = category_add_id + '(' + organization_id + ',' + catsToAdd[i] + ',' + 'true), ';
      }
    }
    catAddSQL = 'INSERT INTO organization_x_category (organization_id, category_id, active) VALUES ' + category_add_id + ';';
  }

  // Submit update/insert to database and render confirmation page
  let completeSQL = mainSQL + catAddSQL + catRemoveSQL;
  client.query(completeSQL)
    .then(res.render('./pages/auth/edit-confirmation'))
    .catch(function(error){
      console.log(error);
    });
})

// Identify which categories should be removed to the org to category mapping and which should be added
function compareCategories(req){
  let newCats = req.body.category;
  let priorCats = (req.body.prior_cats).split(',');
  priorCats[0] = priorCats[0].trim();
  priorCats[priorCats.length-1] = priorCats[priorCats.length-1].trim();

  let catsToRemove = [];
  let catsToAdd = [];
  let outputCats = [];

  for(let i = 0; i < newCats.length; i++){
    if(priorCats.indexOf(newCats[i]) === -1){
      catsToAdd.push(newCats[i])
    }
  }

  outputCats.push(catsToAdd);

  for (let i=0; i<priorCats.length; i++){
    if(newCats.indexOf(priorCats[i]) === -1){
      catsToRemove.push(priorCats[i])
    }
  }

  outputCats.push(catsToRemove);
  console.log(outputCats);
  return outputCats;
}

app.get('/credentialcheck', function(req, res){
  // Listen for session cookie creation
  let sessionCookie = req.cookies.session || ''
  if(sessionCookie !== ''){
    res.redirect('/admin/account')
  } else {
    res.render('./pages/auth/credential-check');
  }
})

app.post('/sessionLogout', (req, res) => {
  const sessionCookie = res.cookies.session || '';
  res.clearCookie('user');
  res.clearCookie('session');
  admin.auth().verifySessionCookie(sessionCookie)
    .then((decodedClaims) => {
      return admin.auth().revokeRefreshTokens(decodedClaims.sub);
    })
    .then(() => {
      res.redirect('/login');
    })
    .catch((error) => {
      res.redirect('/login');
    });
})
