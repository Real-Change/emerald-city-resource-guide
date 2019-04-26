$(document).ready(function() {

  // As httpOnly cookies are to be used, do not persist any state client side.
  // firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);

  // When the user signs in with email and password.
  firebase.auth().onAuthStateChanged(function(user) {
    firebase.auth().currentUser.getIdToken(true).then(function(idToken) {
      return postIdTokenToSessionLogin('/sessionLogin', idToken);
    });
  });


  // sign out user
  $('#signout-button').on('click', function() {
    firebase.auth().signOut().then(function() {
      console.log('Signed Out');
    }, function(error) {
      console.error('Sign Out Error', error);
    });
  });

  // allow user to change their password
  $('#changepassword-button').on('click', function() {
    let user = firebase.auth().currentUser;
    let newPassword = getASecureRandomPassword();
    user.updatePassword(newPassword).then(() => {
      // Update successful.
    }, (error) => {
      // An error happened.
    });
  });


  function postIdTokenToSessionLogin(url, idToken) {
    // POST to session login endpoint.
    return $.ajax({
      type: 'POST',
      url: url,
      data: {
        idToken: idToken
      },
      contentType: 'application/x-www-form-urlencoded'
    });
  }

})

