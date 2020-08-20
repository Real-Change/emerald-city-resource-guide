"use strict";

// application dependencies
require("dotenv").config();
const express = require("express");
const pg = require("pg");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");
var firebase = require("firebase");
require("firebase-app");
require("firebase-auth");
const admin = require("firebase-admin");

const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

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

const client = new pg.Client(process.env.DATABASE_URL);
client.connect().catch((e) => console.error("connection error", e.stack));
client.on("error", (err) => console.log(err));

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

  return client
    .query(SQL, values)
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
  ];
  let SQL =
    "INSERT INTO requests (organization_name, contact_name, email, phone, number, picked_up) VALUES ($1, $2, $3, $4, $5, 'f');";

  return client
    .query(SQL, values)
    .then(res.render("./pages/confirmation.ejs"))
    .catch(handleError);
}

// catches
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

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
      "SELECT DISTINCT organization.*, array_agg(category.category_name) FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE organization.active='t' GROUP BY organization.organization_id, organization.organization_name, organization.website, organization.phone_number, organization.org_address, organization.org_description, organization.schedule, organization.gender, organization.kids, organization.last_update, organization.active, organization.zipcode, organization.contact_name, organization.contact_title, organization.contact_phone, organization.contact_email, organization.distribution, organization.distribution_email, organization.sponsorship, organization.sponsorship_email, organization.id_req ORDER by organization.organization_name;";
  }

  // Return orgs based on keyword search
  else if (requestType === "keyword") {
    SQL =
      "SELECT DISTINCT organization.*, array_agg(category.category_name) FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE ((upper(organization_name) SIMILAR TO $1) OR (upper(website) SIMILAR TO $1) OR (phone_number SIMILAR TO $1) OR (upper(org_address) SIMILAR TO $1) OR (upper(org_description) SIMILAR TO $1)) GROUP BY organization.organization_id, organization.organization_name, organization.website, organization.phone_number, organization.org_address, organization.org_description, organization.schedule, organization.gender, organization.kids, organization.last_update, organization.active, organization.zipcode, organization.contact_name, organization.contact_email, organization.contact_phone, organization.contact_title, organization.sponsorship, organization.sponsorship_email, organization.distribution, organization.distribution_email, organization.id_req ORDER BY organization_name;";
  }

  // Return orgs based on form
  else {
    SQL =
      "SELECT DISTINCT orgs.*, array_agg(category.category_name) FROM organization AS orgs INNER JOIN organization_x_category ON orgs.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE ";

    let genderQuery = makeGenderQuery(gender);
    let categoryQuery = makeCategoryQuery(category);

    // add all the query components  into a single SQL query
    SQL =
      SQL +
      genderQuery +
      " AND (" +
      categoryQuery +
      ") AND (organization_x_category.active='t') AND (orgs.active='t') GROUP BY orgs.organization_id, orgs.organization_name, orgs.website, orgs.phone_number, orgs.org_address, orgs.org_description, orgs.schedule, orgs.gender, orgs.kids, orgs.last_update, orgs.active, orgs.zipcode, orgs.contact_name, orgs.contact_email, orgs.contact_phone, orgs.contact_title, orgs.sponsorship, orgs.sponsorship_email, orgs.distribution, orgs.distribution_email, orgs.id_req ORDER by orgs.organization_name;";
  }
  console.log("SQL", SQL);
  return SQL;
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
  return client
    .query(SQL, values)
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
};

// Function to call in every admin page to verify permissions
function isAuthenticated(req, res, next) {
  let userEmail = req.cookies.user || "";
  let SQL = "SELECT * FROM users WHERE email='" + userEmail + "';";
  return client
    .query(SQL)
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

      return client.query(SQL).then((results) => {
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

app.post("/admin/:searchTerm", isAuthenticated, returnAdminResults);

function returnAdminResults(req, res) {
  let searchTerm = req.body.searchbar.trim().split(" ");
  let radioChoice = req.body.adminradio;
  let updateDate = req.body.updatedate;
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
  return client
    .query(SQL)
    .then((result) =>
      res.render("./pages/auth/search-admin-results", { results: result.rows })
    )
    .catch((error) => handleError(error, res));
}

app.post("/admin/update/:orgId", isAuthenticated, editOrg);

function editOrg(req, res) {
  let orgId = req.params.orgId;
  let SQL =
    "SELECT DISTINCT organization.*, array_agg(DISTINCT(category.category_id)) FROM organization INNER JOIN organization_x_category ON organization.organization_id=organization_x_category.organization_id INNER JOIN category ON organization_x_category.category_id=category.category_id WHERE (organization.organization_id=" +
    orgId +
    " AND organization_x_category.active='t') GROUP BY organization.organization_id, organization.organization_name, organization.website, organization.phone_number, organization.org_address, organization.org_description, organization.schedule, organization.gender, organization.kids, organization.last_update, organization.active, organization.zipcode, organization.contact_name, organization.contact_title, organization.contact_phone, organization.contact_email, organization.distribution, organization.distribution_email, organization.sponsorship, organization.sponsorship_email, organization.id_req ORDER by organization.organization_name;";

  client
    .query(SQL)
    .then((result) =>
      res.render("./pages/auth/org-edit", { results: result.rows[0] })
    )
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
zipcode;

// Identify which categories should be removed to the org to category mapping and which should be added
function compareCategories(req) {
  let newCats = req.body.category;
  let priorCats = req.body.prior_cats.split(",");
  priorCats[0] = priorCats[0].trim();
  priorCats[priorCats.length - 1] = priorCats[priorCats.length - 1].trim();

  let catsToRemove = [];
  let catsToAdd = [];
  let outputCats = [];

  for (let i = 0; i < newCats.length; i++) {
    if (priorCats.indexOf(newCats[i]) === -1) {
      catsToAdd.push(newCats[i]);
    }
  }

  outputCats.push(catsToAdd);

  for (let i = 0; i < priorCats.length; i++) {
    if (newCats.indexOf(priorCats[i]) === -1) {
      catsToRemove.push(priorCats[i]);
    }
  }

  outputCats.push(catsToRemove);
  return outputCats;
}

function parseForm(req) {
  // Escape single quote to prevent SQL errors
  function replaceChar(str){
      return str.replace(/'/g, "''");
  }
  organization_id = req.body.id;
  organization_name = replaceChar(req.body.name);
  website = req.body.website.trim();
  phone_number = replaceChar(req.body.phone_number);
  org_address = replaceChar(req.body.org_address);
  org_description = replaceChar(req.body.org_description);
  schedule = req.body.schedule;
  gender = req.body.gender;
  timestamp = req.body.timestamp;
  contact_name = replaceChar(req.body.contact_name);
  contact_title = replaceChar(req.body.contact_title);
  contact_email = replaceChar(req.body.contact_email);
  contact_phone = replaceChar(req.body.contact_phone);

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
    " WHERE organization_id=" +
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
      if (catsToAdd.length === 1) {
        category_add_id =
          category_add_id +
          organization_id +
          "," +
          catsToAdd[i] +
          "," +
          "true)";
      } else if (i === 0) {
        category_add_id =
          category_add_id +
          organization_id +
          "," +
          catsToAdd[i] +
          "," +
          "true), ";
      } else if (i === catsToAdd.length - 1) {
        category_add_id =
          category_add_id +
          "(" +
          organization_id +
          "," +
          catsToAdd[i] +
          "," +
          "true)";
      } else {
        category_add_id =
          category_add_id +
          "(" +
          organization_id +
          "," +
          catsToAdd[i] +
          "," +
          "true), ";
      }
    }
    catAddSQL =
      "INSERT INTO organization_x_category (organization_id, category_id, active) VALUES " +
      category_add_id +
      ";";
  }

  // Submit update/insert to database and render confirmation page
  let completeSQL = mainSQL + catAddSQL + catRemoveSQL;
  client
    .query(completeSQL)
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
    "INSERT INTO organization (organization_name, website, phone_number, org_address, org_description, schedule, gender, last_update, contact_name, contact_title, contact_email, contact_phone, id_req, distribution, distribution_email, sponsorship_email, sponsorship, zipcode, active) VALUES('" +
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
    ", 't');";

  // Create SQL query for adding categories
  let cats = req.body.category;
  let catAddSQL =
    "INSERT INTO organization_x_category (organization_id, category_id, active) VALUES (";
  let allCatsSQL = "";

  cats.forEach((cat) => {
    catAddSQL =
      catAddSQL +
      "(SELECT organization_id FROM organization WHERE organization_name='" +
      organization_name +
      "'), " +
      cat +
      ", 't'); ";
    allCatsSQL = allCatsSQL + catAddSQL;
    catAddSQL =
      "INSERT INTO organization_x_category (organization_id, category_id, active) VALUES (";
  });

  // Submit update/insert to database and render confirmation page
  let completeSQL = mainSQL + allCatsSQL;
  client
    .query(completeSQL)
    .then(res.render("./pages/auth/add-confirmation"))
    .catch(function (error) {
      console.log(error);
    });
});

app.get("/admin/copyrequests", isAuthenticated, function (req, res) {
  let SQL =
    "SELECT * FROM requests WHERE  picked_up='f' ORDER BY LOWER(organization_name);";

  return client.query(SQL).then((results) =>
    res.render("./pages/auth/copy-requests.ejs", {
      requests: results.rows,
    })
  );
});

app.post("/admin/pickedup/guide", isAuthenticated, function (req, res) {
  let values = [req.body.request_id];
  let SQL = "UPDATE requests SET picked_up='t' WHERE request_id=$1;";

  return client.query(SQL, values).then(res.redirect("/admin/copyrequests"));
});
