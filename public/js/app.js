$(document).ready(function () {

  // data validation for form to ensure that user selects at least one category
  $('#submit-button').click(function() {
    const checked = $('input[type=checkbox]:checked').length;

    if(!checked) {
      alert('Please check at least one checkbox.');
      return false;
    }
  });

  // dynamically generate list of results
  let n = $('li').length;
  $('#count').text(n + ' results');
});


