$(document).ready(function () {

  // data validation for form to ensure that user selects at least one category
  $('#submit-button').click(function() {
    const checked = $('input[type=checkbox]:checked').length;

    if(!checked) {
      alert('Please check at least one checkbox.');
      return false;
    }
  });

  // dynamically generate number of results
  let n = $('.organization-item').length;
  $('#count').text(n + ' results');

  // hamburger menu management
  $('header i').on('click', function(){
    $('.menu').toggleClass('hidden');
    $('#mobile-nav').toggleClass('hidden');
  });

  // show and hide descriptions on results page
  $('.desc-button').on('click', function(){
    $(this).toggleClass('fa-chevron-circle-down fa-chevron-circle-up');
    $(this).next('p').toggleClass('hidden');
  });

  // copy contact email address on button click
  const emailLink = document.querySelector('#emaillink');

  $('#emailcopy').on('click', function() {
    const range = document.createRange();
    range.selectNode(emailLink);
    window.getSelection().addRange(range);
    try{
      const successful = document.execCommand('copy');
      const msg = successful ? 'successful' : 'unsuccessful';
      console.log('Copy email command was ' + msg);
    } catch(err) {
      console.log('Oops, unable to copy');
    }
    window.getSelection().removeAllRanges();
  });

  // set min for date in copy request form to today
  let today = new Date();
  let dd = today.getDate()+1;
  let mm = today.getMonth()+1;
  let yyyy = today.getFullYear();

  if (dd < 0){
    dd='0'+ dd;
  }
  if (mm < 10){
    mm='0' + mm
  }
  today = yyyy + '-' + mm + '-' + dd;
  $('#form-date').attr('min', today);


  // only show results that match dropdown selection
  $('#filters').change( function() {
    let selection = $('option:selected').val();
    $('li').not(':contains(\'' + selection +'\')').addClass('hidden');
    $('li:contains(\'' + selection +'\')').removeClass('hidden');
    $('#clear-filter').removeClass('hidden');
  });

  // clear filters
  $('#clear-filter').on('click', function() {
    $('li').removeClass('hidden');
    $('#clear-filter').addClass('hidden');
    $('#filters').val('default');
  });

  // create printer-friendly version of results page
  $('#print-button').on('click', function(){
    $('header').toggleClass('no-print');
    $('#count').toggleClass('no-print');
    $('#filter-container').toggleClass('no-print');
    $('.d').toggleClass('no-print');
    $('main').toggleClass('print-style');
    $('.desc').removeClass('hidden');
    $('.fas').addClass('hidden');
    $(this).text($(this).text() === 'Print Results' ? 'Return to Results' : 'Print Results');
    if($('#print-button').text() === 'Return to Results') {
      window.print();
    } else {
      $('.desc').addClass('hidden');
      $('.fas').removeClass('hidden');
    }
  });


  // show appropriate confirmation message after contact page
  if(window.location.href.indexOf('feedback') > -1){
    $('#feedback-confirmation').removeClass('hidden');
    $('#order-confirmation').addClass('hidden')
  }

  // updates the print menu based on checkbox just selected or deselected
  $('#allcats :checkbox').change(function() {    // if a checkbox has just been selected or deselected 
    var selectedId = $(this).val();               // get the ID of the checkbox

    // if box was just Unchecked  And it was a currently selected print option we needs to deselect it 
    if ((! $(this).is(":checked"))  && ($("#selectedPrintOptions option:selected").prop("value") === selectedId)) {
         $("#selectedPrintOptions option[value=" + selectedId + "]").prop('selected', false);  // unselect from menu
    }
    $("#selectedPrintOptions option[value=" + selectedId + "]").toggle();  // toggle between hiding and showing in print menu

    if ( $('#selectedPrintOptions :selected').length === 0 ) {
      $('#selectedPrintOptions option[value="default"]').prop('selected', true);
    }
  });

  // enforce that they can never select more than 2 print locations
  // if select 3rd choice deselect all as there is no way to know what one they just added.
  $('#selectedPrintOptions').change(function() {
    var count = $('#selectedPrintOptions :selected').length;
    if ( (count > 2) ||
       ( (count === 2) && ($('#selectedPrintOptions option[value="default"]').is(':selected') ) ))  {
        if (count > 2) {
          alert("No more than 2 print chapters can be selected. Please reselect print chapters");
        } else {
          alert('When selecting Multiple Print Chapters, "None Selected" is not a valid option. Please reselect print chapters');
        }

        // deselect all print options and select "None Selected"
        $('#selectedPrintOptions option:selected').each(function() {
          $("#selectedPrintOptions option[value=" + $(this).prop("value") + "]").prop('selected', false);  // unselect from menu
        });
        $('#selectedPrintOptions option[value="default"]').prop('selected', true);
       }
       
  });

  $('#form-number').change(function() {
    $('#form-number-donate-warning').toggle(parseInt(this.value, 10) >= 300);
  });

  $('.delete_button').click(function() {
    const orgId = $(this).data('id');
    if (confirm(`Are you sure you want to delete this organization?`)) {
      $.ajax({
        type: "POST",
        url: `/admin/delete/${orgId}`,
        success: () => window.location.reload(),
      });
    }
    return false;
  });
});
