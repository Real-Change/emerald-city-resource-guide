$(document).ready(function() {

  // As httpOnly cookies are to be used, do not persist any state client side.
  // firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);

  // When the user signs in with email and password.
  firebase.auth().onAuthStateChanged(function(user) {
    console.log('getIdtoken:  ', firebase.auth().currentUser.getIdToken());
    firebase.auth().currentUser.getIdToken(true).then(function(idToken) {
      return postIdTokenToSessionLogin('/sessionLogin', idToken);
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


// enable contact form submit buttons when reCAPTCHA completed
function recaptcha_callback(){
  console.log('recaptcha callback triggered');
  $('.request-button').prop('disabled', false);
}
