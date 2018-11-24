$(document).ready(function () {
  $('#submit-button').click(function() {
    const checked = $('input[type=checkbox]:checked').length;

    if(!checked) {
      alert('Please check at least one checkbox.');
      return false;
    }
  });
});
