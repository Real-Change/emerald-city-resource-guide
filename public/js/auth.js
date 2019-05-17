/* eslint-disable no-undef */
$(document).ready(function() {
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(function() {
      // When the user signs in with email and password.
      firebase.auth().onAuthStateChanged(function(user) {
        if(user){
          console.log('getIdToken   :', firebase.auth().currentUser.getIdToken());
          firebase.auth().currentUser.getIdToken(true).then(function(idToken) {
            return postIdTokenToSessionLogin('/sessionLogin', idToken);
          });
        }
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

    if(location.href === 'http://localhost:8080/credentialcheck'){
      setTimeout(location.reload.bind(location), 5000);
    }

})

// enable contact form submit buttons when reCAPTCHA completed
function recaptcha_callback(){
  console.log('recaptcha callback triggered');
  $('.request-button').prop('disabled', false);
}
