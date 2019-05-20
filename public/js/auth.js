/* eslint-disable no-undef */
$(document).ready(function() {
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(function() {
      // When the user signs in with email and password.
      firebase.auth().onAuthStateChanged(function(user) {
        if(user !== null){
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

  // Only allow two refreshes of credential check site when signing in

  if(window.location.href.indexOf('admin') > -1){
    localStorage.setItem('counter', 0);
    $('#desktop-nav form').toggleClass('hidden');
    $('#mobile-nav form').toggleClass('hidden');
    $('#admin-search').toggleClass('hidden');
    $('#login').toggleClass('hidden');
    $('#admin-search-desktop').toggleClass('hidden');
    $('#login-desktop').toggleClass('hidden');
    $('#desktop-nav a').addClass('admin-nav');
    $('#rclogoimg').attr('src', '/../images/RC_Logo_HigherRes.jpg')
  }

  if(window.location.href.indexOf('credentialcheck') > -1){
    let counter = parseInt(localStorage.getItem('counter'));
    if(counter === undefined){
      localStorage.setItem('counter', 0);
      setTimeout(location.reload.bind(location), 5000);
    } else if(counter< 2){
      counter++;
      localStorage.setItem('counter', counter)
      setTimeout(location.reload.bind(location), 5000);
    } else {
      alert('You do not have administrative permissions for this site. Please email ecrgseattle@gmail.com to request assistance if you believe you have received this message in error.')
      window.location.replace('/login');
      localStorage.setItem('counter', 0)
    }
  }

  // set timestamp for admin edit form
  let timestamp = (new Date()).getFullYear() + '-' + ((new Date()).getMonth()+1) + '-' + (new Date()).getDate() + ' ' + (new Date()).getHours() + ':' + (new Date()).getMinutes() +':00-07';
  $('#timestamp').attr('value', timestamp)

  // show tooltip on admin search page
  $('#tooltip-container').hover(function(){
    $('span.tooltip').toggleClass('hidden')
  })
})

// enable contact form submit buttons when reCAPTCHA completed
function recaptcha_callback(){
  console.log('recaptcha callback triggered');
  $('.request-button').prop('disabled', false);
}
