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
  let n = $('li').length;
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

  // icon tooltip display on mobile
  $('#icons i').one('tap', function(){
    let title = $(this).attr('title')
    $(this).append(`<p class="tooltip">` + title + `</p>`);
  });

  $('body').on('touchstart', function(){
    $('.tooltip').hide();
  })
});


