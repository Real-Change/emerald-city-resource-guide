$(document).ready(function(){

  // pass user token to backend upon sign in
  firebase.auth().currentUser.getIdToken(true).then(function(idToken) {
    // Send token to your backend via HTTPS
    // ...
  }).catch(function(error) {
    // Handle error
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
  })

})

