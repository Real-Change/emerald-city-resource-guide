$(document).ready(function () {
  $('#submit-button').click(function() {
    const checked = $('input[type=checkbox]:checked').length;

    if(!checked) {
      alert('Please check at least one checkbox.');
      return false;
    }
  });

  // //Trying to get selected checkboxes into a single array for use in getOrgs function in server file
  // $('#submit-button').click(function() {
  //   var sel = $('input[type=checkbox]:checked').map(function(_, el) {
  //     return $(el).val();
  //   }).get();
  //   console.log(sel);
  // })
});


