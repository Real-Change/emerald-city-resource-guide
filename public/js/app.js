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

  // clear local storage on page load
  if($('body').is('.index')) {
    localStorage.clear();
  }

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

  // save selected populations and services to local storage -- NOT CURRENTLY IN USE
  $('#search-form input').change(function(){
    if ($(this).prop('checked')){
      localStorage.setItem(this.name, this.value);
    } else {
      localStorage.removeItem(this.name, this.value);
    }
  });
  $('#search-form select').change(function(){
    localStorage.setItem(this.name, this.value);
  });

});



