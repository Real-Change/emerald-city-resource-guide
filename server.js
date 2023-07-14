"use strict";

// application dependencies
require("dotenv").config();
const express = require("express");
const pg = require("pg");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");
const csv = require("csv/dist/cjs/sync.cjs")
var firebase = require("firebase");
require("firebase-app");
require("firebase-auth");
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.GOOGLE_CONFIG || '{}');

// initialize Firebase
firebase.initializeApp(process.env.FIREBASE_CONFIG);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://emerald-city-resource-guide.firebaseio.com",
});

// application setup
const app = express();
const PORT = process.env.PORT || 8080;

// application middleware
app.use(express.static("./public"));
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cookieParser());
app.use(
  cookieSession({
    name: "session",
    keys: ["key1", "key2"],
  })
);

app.use(function (req, res, next) {
  res.locals.user = req.cookies.user;
  next();
});

pg.defaults.ssl = true;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err, client) => {
  console.error('Unexpected error', err);
});

app.use(
  methodOverride((request) => {
    if (
      request.body &&
      typeof request.body === "object" &&
      "_method" in request.body
    ) {
      let method = request.body._method;
      delete request.body._method;
      return method;
    }
  })
);

// set the view engine for server-side templating
app.set("view engine", "ejs");
app.post("/results", getOrgs);

// GET method route to render form page
app.get("/", function (req, res) {
  res.render("./pages/index.ejs");
});

// GET method route to render contact page
app.get("/contact", function (req, res) {
  res.render("./pages/contact.ejs");
});

// GET method route to render login page
app.get("/login", function (req, res) {
  const sessionCookie = req.cookies.session || "";
  // Verify the session cookie and redirect to admin if already logged in
  admin
    .auth()
    .verifySessionCookie(sessionCookie, true /** checkRevoked */)
    .then(() => {
      res.redirect("/admin/account");
    })
    .catch(() => {
      res.render("./pages/auth/login.ejs");
    });
});

// POST method for feedback submission on contact page
app.post("/feedbackconfirmation", submitFeedback);
app.post("/requestconfirmation", submitRequest);

// method to submit feedback
function submitFeedback(req, res) {
  let values = [
    req.body.organization,
    req.body.name,
    req.body.email,
    req.body.feedbackfield,
  ];
  let SQL =
    "INSERT INTO feedback (org_name, contact_name, contact_email, message, date) VALUES ($1, $2, $3, $4, NOW());";

  return doQuery(SQL, values)
    .then(res.render("./pages/confirmation.ejs"))
    .catch(handleError);
}

// POST method for copy request on contact page
app.post("/requestconfirmation", submitRequest);

function submitRequest(req, res) {
  let values = [
    req.body.organization,
    req.body.name,
    req.body.email,
    req.body.phone,
    req.body.number,
    req.body.is_branch === 't' ? 't' : 'f',
  ];
  let SQL =
    "INSERT INTO requests (organization_name, contact_name, email, phone, number, is_branch, picked_up, date) VALUES ($1, $2, $3, $4, $5, $6, 'f', CURRENT_TIMESTAMP);";

  return doQuery(SQL, values)
    .then(res.render("./pages/confirmation.ejs"))
    .catch(handleError);
}

// POST method for email list sign up page
app.post("/mailinglistconfirmation", submitToMailingList);

function submitToMailingList(req, res) {
  let values = [
    req.body.organization_name,
    req.body.contact_name,
    req.body.email,
    req.body.phone,
  ];
  let SQL = "INSERT INTO mailing_list (organization_name, contact_name, email, phone, date) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP);";

  return doQuery(SQL, values)
    .then(res.render("./pages/confirmation.ejs"))
    .catch(handleError);
}

// catches
var server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// method to identify selected categories
function makeCategoryQuery(category) {
  // add category selection to SQL query and terminate the query with the last category in the array
  let categoryQuery = "";
  category.forEach(function (el) {
    let i = category.length - 1;
    if (el === category[i]) {
      categoryQuery =
        categoryQuery + "organization_x_category.category_id=" + el;
    } else {
      categoryQuery =
        categoryQuery + "organization_x_category.category_id=" + el + " OR ";
    }
  });
  return categoryQuery;
}

// method to identify selected gender
function makeGenderQuery(gender) {
  let genderQuery = "";

  // add gender selection to SQL query
  switch (gender) {
    case "female":
      genderQuery = "(gender='women only' OR gender='no restrictions')";
      break;
    case "male":
      genderQuery = "(gender='men only' OR gender='no restrictions')";
      break;
    default:
      genderQuery =
        "(gender='no restrictions' OR gender='men only' OR gender='women only')";
  }
  return genderQuery;
}

// method to generate SQL query
function makeSQL(requestType, category, gender) {
  let SQL;

  // Return all orgs
  if (requestType === "all") {
    SQL =
      "SELECT o.organization_id, o.organization_name, o.website, o.phone_number, o.org_address, o.org_description, o.schedule, o.gender, o.kids, o.last_update, o.active, o.zipcode, o.contact_name, o.contact_email, o.contact_phone, o.contact_title, o.sponsorship, o.sponsorship_email, o.distribution, o.distribution_email, o.tempcovid, o.id_req, join1.category_names " +
      "FROM organization o " +
      "INNER JOIN ( " +
        "SELECT oxc1.organization_id, oxc1.active, array_agg(join2.category_name) AS category_names " +
        "FROM organization_x_category oxc1 " +
        "INNER JOIN ( " +
          "SELECT c.category_id, c.category_name " +
          "FROM category c " + 
        ") join2 ON (oxc1.category_id=join2.category_id) " +
        "GROUP BY oxc1.organization_id, oxc1.active " +
      ") join1 ON ((o.organization_id=join1.organization_id) AND (o.active='t') AND (join1.active='t')) " +
      "WHERE o.active='t' " +
      "ORDER BY o.organization_name; ";
}

  // Return orgs based on keyword search
  else if (requestType === "keyword") {
    SQL =
      "SELECT o.organization_id, o.organization_name, o.website, o.phone_number, o.org_address, o.org_description, o.schedule, o.gender, o.kids, o.last_update, o.active, o.zipcode, o.contact_name, o.contact_email, o.contact_phone, o.contact_title, o.sponsorship, o.sponsorship_email, o.distribution, o.distribution_email, o.tempcovid, o.id_req, join1.category_names " +
      "FROM organization o " +
      "INNER JOIN ( " +
        "SELECT oxc1.organization_id, oxc1.active, array_agg(join2.category_name) AS category_names " +
        "FROM organization_x_category oxc1 " +
        "INNER JOIN ( " +
          "SELECT c.category_id, c.category_name " +
          "FROM category c " + 
        ") join2 ON (oxc1.category_id=join2.category_id) " +
        "GROUP BY oxc1.organization_id, oxc1.active " +
      ") join1 ON ((o.organization_id=join1.organization_id) AND (o.active='t') AND (join1.active='t')) " +
      "WHERE ((upper(organization_name) SIMILAR TO $1) OR (upper(website) SIMILAR TO $1) OR (phone_number SIMILAR TO $1) OR (upper(org_address) SIMILAR TO $1) OR (upper(org_description) SIMILAR TO $1)) " +
      "ORDER BY o.organization_name; ";
  }

  // Return orgs based on form
  else {
   
    let genderQuery = makeGenderQuery(gender);
    let categoryQuery = makeCategoryQuery(category);

   SQL =
      "SELECT o.organization_id, o.organization_name, o.website, o.phone_number, o.org_address, o.org_description, o.schedule, o.gender, o.kids, o.last_update, o.active, o.zipcode, o.contact_name, o.contact_email, o.contact_phone, o.contact_title, o.sponsorship, o.sponsorship_email, o.distribution, o.distribution_email, o.tempcovid, o.id_req, join1.category_names " +
      "FROM organization o " +
      "INNER JOIN organization_x_category ON organization_x_category.organization_id = o.organization_id AND (" + categoryQuery + ") " +
      "INNER JOIN ( " +
        "SELECT oxc1.organization_id, oxc1.active, array_agg(join2.category_name) AS category_names " +
        "FROM organization_x_category oxc1 " +
        "INNER JOIN ( " +
          "SELECT c.category_id, c.category_name " +
          "FROM category c " + 
        ") join2 ON (oxc1.category_id=join2.category_id) " +
        "GROUP BY oxc1.organization_id, oxc1.active " +
      ") join1 ON ((o.organization_id=join1.organization_id) AND (o.active='t') AND (join1.active='t')) " +
      "WHERE " + genderQuery + " " +
      "ORDER BY o.organization_name; ";
  }
  console.log("SQL", SQL);
  return SQL;
}

function doQuery(SQL, values) {
  return pool
    .connect()
    .then(client => client
      .query(SQL, values)
      .finally(() => client.release())
    );
}

// method to render results
function getOrgs(request, response) {
  let requestType = request.body.submitbutton;
  let { gender, category } = request.body;
  let values = [];
  if (request.body.searchbar) {
    let formattedSearch = "(";

    let searchTermArray = request.body.searchbar
      .trim()
      .toUpperCase()
      .split(" ");
    for (let i = 0; i < searchTermArray.length; i++) {
      formattedSearch += "%" + searchTermArray[i] + "%";
    }

    values.push(formattedSearch + ")");
    console.log(values);
  }

  let SQL = makeSQL(requestType, category, gender, request);

  // pass SQL query and values from request to render results
  return doQuery(SQL, values)
    .then((results) =>
      response.render("./pages/results.ejs", {
        results: results.rows,
      })
    )
    .catch(handleError);
}

// error handling
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send("Sorry, something went wrong");
}

// export methods for testing and authorization
module.exports = {
  makeCategoryQuery: makeCategoryQuery,
  makeGenderQuery: makeGenderQuery,
  makeSQL: makeSQL,
  server: server,
};

// Function to call in every admin page to verify permissions
function isAuthenticated(req, res, next) {
  let userEmail = req.cookies.user || "";
  let SQL = "SELECT * FROM users WHERE email='" + userEmail + "';";
  return doQuery(SQL)
    .then((results) => {
      if (results.rowCount > 0) {
        next();
      } else {
        res.redirect("/login");
      }
    })
    .catch(handleError);
}

app.post("/sessionLogin", (req, res) => {
  // Get the ID token passed and the CSRF token.
  const idToken = req.body.idToken.toString();

  // Set session expiration to 5 days.
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  // Create the session cookie. This will also verify the ID token in the process.
  // The session cookie will have the same claims as the ID token.
  // To only allow session cookie setting on recent sign-in, auth_time in ID token
  // can be checked to ensure user was recently signed in before creating a session cookie.
  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedIdToken) => {
      let userEmail = decodedIdToken.email;
      let SQL = "SELECT * FROM users WHERE email = '" + userEmail + "';";

      return doQuery(SQL)
        .then((results) => {
        if (results.rowCount > 0) {
          // Create session cookie and set it.

          admin
            .auth()
            .createSessionCookie(idToken, {
              expiresIn,
            })
            .then((sessionCookie) => {
              // Set cookie policy for session cookie.
              const options = {
                maxAge: expiresIn,
                httpOnly: true,
                secure: false,
              };
              res.cookie("session", sessionCookie, options);
              res.cookie("user", userEmail, options);
              res.end(
                JSON.stringify({
                  status: "success",
                })
              );
            })
            .catch((error) => {
              res.status(401).send("UNAUTHORIZED REQUEST!", error);
            });
        } else {
          res.redirect("/login");
        }
      });
    })
    .catch((error) => {
      res.status(401).send(error);
    });
});

// Whenever a user is accessing restricted content that requires authentication.

app.get("/sessionConfirmation", (req, res) => {
  const sessionCookie = req.cookies.session || "";
  // Verify the session cookie. In this case an additional check is added to detect
  // if the user's Firebase session was revoked, user deleted/disabled, etc.
  admin
    .auth()
    .verifySessionCookie(sessionCookie, true /** checkRevoked */)
    .then(() => {
      res.redirect("/admin/account");
    })
    .catch((error) => {
      console.log("verification error", error);
      // Session cookie is unavailable or invalid. Force user to login.
      res.redirect("/login");
      console.log("forced back to login");
    });
});

app.get("/credentialcheck", function (req, res) {
  // Listen for session cookie creation
  let sessionCookie = req.cookies.session || "";
  if (sessionCookie !== "") {
    res.redirect("/admin/account");
  } else {
    res.render("./pages/auth/credential-check");
  }
});

// Sign out user by clearing cookie and redirecting
app.post("/sessionLogout", (req, res) => {
  const sessionCookie = req.cookies.session || "";
  res.clearCookie("user");
  res.clearCookie("session");
  admin
    .auth()
    .verifySessionCookie(sessionCookie)
    .then((decodedClaims) => {
      return admin.auth().revokeRefreshTokens(decodedClaims.sub);
    })
    .then(() => {
      res.redirect("/login");
    })
    .catch((error) => {
      console.log(error);
      res.redirect("/login");
    });
});

// Render account page if authorized

app.get("/admin/account", isAuthenticated, (req, res) => {
  res.render("./pages/auth/account.ejs");
});

app.get("/admin/:searchTerm", isAuthenticated, returnAdminResults);

function returnAdminResults(req, res) {
  let searchTerm = req.query.searchbar.trim().split(" ");
  let radioChoice = req.query.adminradio;
  let updateDate = req.query.updatedate;
  let searchInput;
  let SQL;
  let nameInput;
  let dateInput = "";

  if (updateDate) {
    dateInput =
      "AND (last_update<to_timestamp('" +
      updateDate +
      "', 'YYYY-MM-DD HH:MI:SS')) ";
  }

  if (radioChoice === "includes") {
    if (searchTerm.length === 1) {
      let cleanSearchTerm = searchTerm[0].split("'");
      searchInput = "'%" + cleanSearchTerm[0].toUpperCase() + "%'";

      SQL =
        "SELECT DISTINCT * FROM organization WHERE active='t' AND (upper(organization_name) LIKE " +
        searchInput +
        ") " +
        dateInput +
        "ORDER BY organization_name;";
    } else {
      let nameInput = "(upper(organization_name) LIKE ";
      searchTerm.forEach(function (el) {
        let i = searchTerm.indexOf(el);
        let cleanSearchTerm = searchTerm[i].split("'");
        searchInput = "'%" + cleanSearchTerm[0].toUpperCase() + "%'";
        if (i === 0) {
          nameInput = nameInput + searchInput + " AND ";
        } else if (i < searchTerm.length - 1) {
          nameInput =
            nameInput +
            "upper(organization_name) LIKE " +
            searchInput +
            " AND ";
        } else {
          nameInput =
            nameInput + "upper(organization_name) LIKE " + searchInput + ")";
        }
      });
      SQL =
        "SELECT DISTINCT * FROM organization WHERE (" +
        nameInput +
        ") AND active='t'" +
        dateInput +
        " ORDER BY organization_name;";
    }
  } else {
    if (searchTerm.length === 1) {
      let cleanSearchTerm = searchTerm[0].split("'");
      searchInput = "'" + cleanSearchTerm[0].toUpperCase() + "%'";

      SQL =
        "SELECT DISTINCT * FROM organization WHERE active='t' AND (upper(organization_name) LIKE " +
        searchInput +
        ") " +
        dateInput +
        " ORDER BY organization_name;";
    } else {
      nameInput = "(upper(organization_name)= ";
      searchTerm.forEach(function (el) {
        let i = searchTerm.indexOf(el);
        let cleanSearchTerm = searchTerm[i].split("'");
        searchInput = "'" + cleanSearchTerm[0].toUpperCase() + "%'";
        if (i === 0) {
          nameInput = nameInput + searchInput + " AND ";
        } else if (i < searchTerm.length - 1) {
          nameInput =
            nameInput +
            "upper(organization_name) LIKE " +
            searchInput +
            " AND ";
        } else {
          nameInput =
            nameInput + "upper(organization_name) LIKE " + searchInput + ")";
        }
      });
      SQL =
        "SELECT DISTINCT * FROM organization WHERE (" +
        nameInput +
        ") AND active='t'" +
        dateInput +
        " ORDER BY organization_name;";
    }
  }
  return doQuery(SQL)
    .then((result) =>
      res.render("./pages/auth/search-admin-results", { results: result.rows })
    )
    .catch((error) => handleError(error, res));
}

app.post("/admin/delete/:orgId", isAuthenticated, function(req, res) {
  const orgId = req.params.orgId;
  const SQL = 'DELETE FROM organization WHERE organization_id = $1;';
  return doQuery(SQL, [orgId])
    .then(() => res.sendStatus(200))
    .catch(handleError);
});

app.post("/admin/update/:orgId", isAuthenticated, editOrg);

function editOrg(req, res) {
  let orgId = req.params.orgId;
  let SQL =
    "SELECT o.*, join1.categories, join2.print_locations " +
    "FROM organization o " +
    "INNER JOIN ( " +
      "SELECT oxc1.organization_id, oxc1.active, array_agg(category_id) AS categories " +
      "FROM organization_x_category oxc1 " +
      "GROUP BY oxc1.organization_id, oxc1.active " +
    ") join1 ON ((o.organization_id = join1.organization_id) AND join1.active='t') " +
    "LEFT OUTER JOIN ( " +
      "SELECT  oxc2.organization_id, oxc2.active, oxc2.print_location, array_agg(category_id) AS print_locations " +
      "FROM organization_x_category oxc2 " +
      "GROUP BY oxc2.organization_id, oxc2.active, oxc2.print_location " +
    ") join2 ON ((o.organization_id = join2.organization_id) AND join2.active='t' AND join2.print_location='t') " +
    "WHERE (o.organization_id=" + orgId + ");";

  doQuery(SQL)
    .then((result) => {
      if (result.rows[0].print_locations === null) {
        result.rows[0].print_locations = [-1];  //default case
      }
      return res.render("./pages/auth/org-edit", { results: result.rows[0] })
    })
    .catch(handleError);
}

let organization_id,
  organization_name,
  website,
  phone_number,
  org_address,
  org_description,
  schedule,
  gender,
  timestamp,
  contact_name,
  contact_title,
  contact_email,
  contact_phone,
  id_req,
  distribution,
  distribution_email,
  sponsorship_email,
  sponsorship,
  zipcode,
  tempcovid,
  print_locations;

// Identify which categories should be removed to the org to category mapping and which should be added
function compareCategories(req) {
  let newCats = req.body.category;
  let priorCats = req.body.prior_cats.split(",");
  let priorPrints = req.body.prior_prints.split(",");
  let newPrints = req.body.print_locations;
  priorCats[0] = priorCats[0].trim();
  priorCats[priorCats.length - 1] = priorCats[priorCats.length - 1].trim();
  priorPrints[0] = priorPrints[0].trim();
  priorPrints[priorPrints.length - 1] = priorPrints[priorPrints.length - 1].trim();

  let catsToRemove = [];
  let catsToAdd = [];
  let outputCats = [];

  for (let i = 0; i < newCats.length; i++) {
    if (priorCats.indexOf(newCats[i]) === -1) {
      catsToAdd.push(newCats[i]);
    }
  }

  for (let i = 0; i < priorCats.length; i++) {
    if (newCats.indexOf(priorCats[i]) === -1) {
      catsToRemove.push(priorCats[i]);
    } else {
      // category checked  before and checked  now, need to check if printLocation changed for it
      if ( ((priorPrints.indexOf(priorCats[i]) === -1) && (newPrints.indexOf(priorCats[i]) !== -1)) ||
           ((priorPrints.indexOf(priorCats[i]) !== -1) && (newPrints.indexOf(priorCats[i]) === -1))  ) { 
        catsToRemove.push(priorCats[i])
        catsToAdd.push(priorCats[i])
      } 
    }
  }

  outputCats.push(catsToAdd);
  outputCats.push(catsToRemove);
  return outputCats;
}

function parseForm(req) {
  // Escape single quote to prevent SQL errors
  function replaceChar(str) {
    return str.replace(/'/g, "''");
  }
  organization_id = req.body.id;
  organization_name = replaceChar(req.body.name);
  website = req.body.website.trim();
  phone_number = replaceChar(req.body.phone_number);
  org_address = replaceChar(req.body.org_address);
  org_description = replaceChar(req.body.org_description);
  tempcovid = replaceChar(req.body.tempcovid);
  schedule = req.body.schedule;
  gender = req.body.gender;
  timestamp = req.body.timestamp;
  contact_name = replaceChar(req.body.contact_name);
  contact_title = replaceChar(req.body.contact_title);
  contact_email = replaceChar(req.body.contact_email);
  contact_phone = replaceChar(req.body.contact_phone);
  print_locations = req.body.print_locations;
 
  if (req.body.id_req === "t") {
    id_req = "t";
  } else {
    id_req = "f";
  }

  if (req.body.distribution === "t") {
    distribution = "t";
  } else {
    distribution = "f";
  }
  distribution_email = req.body.distribution_email;

  if (req.body.sponsorship === "t") {
    sponsorship = "t";
  } else {
    sponsorship = "f";
  }
  sponsorship_email = req.body.sponsorship_email;

  if (req.body.zipcode === "" || req.body.zipcode === undefined) {
    zipcode = null;
  } else {
    zipcode = req.body.zipcode;
  }
}

// Submit and confirm record edits

app.put("/admin/editconfirmation", isAuthenticated, function (req, res) {
  // Map form updates into SQL query for organization table
  parseForm(req);

  let mainSQL =
    "UPDATE organization SET organization_name='" +
    organization_name +
    "', website='" +
    website +
    "', phone_number='" +
    phone_number +
    "', org_address='" +
    org_address +
    "', org_description='" +
    org_description +
    "', schedule='" +
    schedule +
    "', gender='" +
    gender +
    "', last_update='" +
    timestamp +
    "', contact_name='" +
    contact_name +
    "', contact_title='" +
    contact_title +
    "', contact_email='" +
    contact_email +
    "', contact_phone='" +
    contact_phone +
    "', id_req='" +
    id_req +
    "', distribution='" +
    distribution +
    "', distribution_email='" +
    distribution_email +
    "', sponsorship='" +
    sponsorship +
    "', sponsorship_email='" +
    sponsorship_email +
    "', zipcode=" +
    zipcode +
    ", tempcovid='" +
    tempcovid +
    "' WHERE organization_id=" +
    organization_id +
    " RETURNING organization_name;";

  //Create SQL queries to remove and add categories for an organization
  let catsArray = compareCategories(req);
  let catsToRemove = catsArray[1];
  let catsToAdd = catsArray[0];

  let category_remove_id = "category_id=";
  let category_add_id = "(";
  let catRemoveSQL;
  let catAddSQL;

  if (catsToRemove.length < 1) {
    catRemoveSQL = "";
  } else {
    for (let i = 0; i < catsToRemove.length; i++) {
      if (catsToRemove.length === 1) {
        category_remove_id = category_remove_id + catsToRemove[i];
      } else if (i === 0) {
        category_remove_id = category_remove_id + catsToRemove[i] + " OR ";
      } else if (i === catsToRemove.length - 1) {
        category_remove_id =
          category_remove_id + "category_id=" + catsToRemove[i];
      } else {
        category_remove_id =
          category_remove_id + "category_id=" + catsToRemove[i] + " OR ";
      }
    }
    catRemoveSQL =
      "UPDATE organization_x_category SET active='false' WHERE organization_id=" +
      organization_id +
      " AND (" +
      category_remove_id +
      ");";
  }

  if (catsToAdd.length < 1) {
    catAddSQL = "";
  } else {
    for (let i = 0; i < catsToAdd.length; i++) {
      // check if this category is one selected for printing in physical catalog
      var print = 'false';
      for (let j = 0; j <print_locations.length; j++) {
        if (catsToAdd[i] === print_locations[j]) {
          print = 'true';
          break;
        }
      }

      if (catsToAdd.length === 1) {
        category_add_id =
          category_add_id +
          organization_id +
          "," +
          catsToAdd[i] +
          "," +
          "true" +
          ", '" +
          print + "')";
      } else if (i === 0) {
        category_add_id =
          category_add_id +
          organization_id +
          "," +
          catsToAdd[i] +
          "," +
          "true" +
          ", '" +
          print + "'), ";
      } else if (i === catsToAdd.length - 1) {
        category_add_id =
          category_add_id +
          "(" +
          organization_id +
          "," +
          catsToAdd[i] +
          "," +
          "true" +
          ", '" + 
          print + "')";
      } else {
        category_add_id =
          category_add_id +
          "(" +
          organization_id +
          "," +
          catsToAdd[i] +
          "," +
          "true" +
          ", '" +
          print + "'), ";
      }
    }
    catAddSQL =
      "INSERT INTO organization_x_category (organization_id, category_id, active, print_location) VALUES " +
      category_add_id +
      ";";
  }

  // Submit update/insert to database and render confirmation page
  let completeSQL = mainSQL + catRemoveSQL + catAddSQL;
  doQuery(completeSQL)
    .then(res.render("./pages/auth/edit-confirmation"))
    .catch(function (error) {
      console.log(error);
    });
});

app.get("/admin/addnew", isAuthenticated, function (req, res) {
  res.render("./pages/auth/addnew");
});

app.put("/admin/addconfirmation", isAuthenticated, function (req, res) {
  // Map form updates into SQL query for organization table
  parseForm(req);

  let mainSQL =
    "INSERT INTO organization (organization_name, website, phone_number, org_address, org_description, schedule, gender, last_update, contact_name, contact_title, contact_email, contact_phone, id_req, distribution, distribution_email, sponsorship_email, sponsorship, zipcode, tempcovid, active) VALUES('" +
    organization_name +
    "', '" +
    website +
    "','" +
    phone_number +
    "', '" +
    org_address +
    "', '" +
    org_description +
    "', '" +
    schedule +
    "', '" +
    gender +
    "', '" +
    timestamp +
    "', '" +
    contact_name +
    "', '" +
    contact_title +
    "', '" +
    contact_email +
    "', '" +
    contact_phone +
    "', '" +
    id_req +
    "', '" +
    distribution +
    "', '" +
    distribution_email +
    "', '" +
    sponsorship_email +
    "', '" +
    sponsorship +
    "', " +
    zipcode +
    ", '" +
    tempcovid +
    "', 't');";

  // Create SQL query for adding categories
  let cats = req.body.category;
  let catAddSQL =
    "INSERT INTO organization_x_category (organization_id, category_id, active, print_location) VALUES (";
  let allCatsSQL = "";

  cats.forEach((cat) => {
    var print = 'f';
    for (let i = 0; i <print_locations.length; i++) {
      if (cat === print_locations[i]) {
        print = 't';
        break;
      }
    }

    catAddSQL =
      catAddSQL +
      "(SELECT organization_id FROM organization WHERE organization_name='" +
      organization_name +
      "'), " +
      cat +
      ", 't', '" + 
      print + "'); ";
    allCatsSQL = allCatsSQL + catAddSQL;
    catAddSQL =
      "INSERT INTO organization_x_category (organization_id, category_id, active, print_location) VALUES (";
  });

  // Submit update/insert to database and render confirmation page
  let completeSQL = mainSQL + allCatsSQL;
  doQuery(completeSQL)
    .then(res.render("./pages/auth/add-confirmation"))
    .catch(function (error) {
      console.log(error);
    });
});

app.get("/admin/organization/csv", isAuthenticated, function (req, res) {
  const SQL = `
    SELECT
      o.organization_id,
      o.organization_name,
      o.website,
      o.phone_number,
      o.org_address,
      o.org_description,
      o.schedule,
      o.gender,
      o.kids,
      o.active::text,
      o.last_update::text,
      o.zipcode,
      o.contact_name,
      o.contact_email,
      o.contact_phone,
      o.contact_title,
      o.sponsorship::text,
      o.distribution::text,
      o.id_req::text,
      o.sponsorship_email,
      o.distribution_email,
      o.org_description_es,
      o.org_address_es,
      o.schedule_es,
      o.tempcovid,
      ARRAY_AGG(c.category_name) AS categories
    FROM organization o
    LEFT JOIN organization_x_category oxc ON (oxc.organization_id = o.organization_id)
    LEFT JOIN category c ON (oxc.category_id = c.category_id)
    GROUP BY o.organization_id
  `;

  return doQuery(SQL)
  .then(function(results) {
    let csvString = csv.stringify(results.rows, {
      header: true,
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('organizations.csv');
    return res.send(csvString);
  });
});


app.get("/admin/copyrequests", isAuthenticated, function (req, res) {
  const SQL =
    "SELECT * FROM requests WHERE picked_up='f' AND deleted='f' ORDER BY LOWER(organization_name);";
  const copyRequests = `
    SELECT
      SUM(number) AS total_requests,
      SUM(CASE WHEN picked_up = 't' THEN number ELSE 0 END) AS total_picked_up
    FROM requests
    WHERE deleted='f'
  `;

  return doQuery(SQL)
  .then(function(results) {
    const pendingRequests = results;
    return doQuery(copyRequests).then(function(results) {
      res.render("./pages/auth/copy-requests.ejs", {
        requests: pendingRequests.rows,
        ...results.rows[0],
     });
    });
  });
});

app.get(
  "/admin/copyrequest/:requestId/edit",
  isAuthenticated,
  function (req, res) {
    let values = [req.params.requestId];
    let SQL = "SELECT * from requests WHERE request_id=$1";

    doQuery(SQL, values)
      .then((result) => {
        res.render("./pages/auth/copy-request-edit", {
          request: result.rows[0],
        });
      })
      .catch(handleError);
  }
);

app.put("/admin/copyrequest/update", isAuthenticated, function (req, res) {
  let { id, organization_name, contact_name, email, phone, number } = req.body;

  let SQL =
    "UPDATE requests SET organization_name='" +
    organization_name +
    "', contact_name='" +
    contact_name +
    "', email='" +
    email +
    "', phone='" +
    phone +
    "', number=" +
    number +
    " WHERE request_id=" +
    id +
    ";";

  return doQuery(SQL)
    .then(res.redirect("/admin/copyrequests"));
});

app.post("/admin/request/pickup", isAuthenticated, function (req, res) {
  let values = [req.body.request_id];
  let SQL = "UPDATE requests SET picked_up='t' WHERE request_id=$1;";

  return doQuery(SQL, values)
    .then(res.redirect("/admin/copyrequests"));
});

app.post("/admin/request/delete", isAuthenticated, function (req, res) {
  let values = [req.body.request_id];
  let SQL = "UPDATE requests SET deleted='t' WHERE request_id=$1;";

  return doQuery(SQL, values)
    .then(res.redirect("/admin/copyrequests"));
});

app.get("/admin/request/download-requests", 
  isAuthenticated, 
  function (req, res) {
    let SQL = 'SELECT * FROM requests ORDER BY request_id ASC';
 
    doQuery(SQL)
      .then(function(dbQueryResult) {
        res.json(dbQueryResult.rows);
      })
      .catch(handleError);
  }
);

app.get("/admin/mailinglist", isAuthenticated, function (req, res) {
  const SQL = "SELECT COUNT(*) AS total FROM mailing_list;";

  return doQuery(SQL)
  .then(function(results) {
    res.render("./pages/auth/mailing-list.ejs", {
      ...results.rows[0],
    });
  });
});

app.get("/admin/mailinglist/csv", isAuthenticated, function (req, res) {
  const SQL = `
    SELECT organization_name, contact_name, email, date::text
    FROM mailing_list
    WHERE organization_name != ''
    ORDER BY date DESC
  `;

  return doQuery(SQL)
  .then(function(results) {
    let csvString = csv.stringify(results.rows, {
      header: true,
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('mailing-list.csv');
    return res.send(csvString);
  });
});

