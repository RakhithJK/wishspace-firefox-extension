/*Lint preferences*/
/*global $:false */
/*global chrome:false */

function showError(message) {
  $('#status').html(message);
  $('#status').attr('class', 'alert alert-danger');
  $('#status').fadeIn('slow');
  $('#status').delay(5000).fadeOut('slow');
}

function showSuccess(message) {
  $('#status').html(message);
  $('#status').attr('class', 'alert alert-success');
  $('#status').fadeIn();
  $('#status').delay(10000).fadeOut('slow');
}

// Restores state using the preferences stored in chrome.storage.
$( document ).ready(function() {
  chrome.storage.sync.get({user: {}}, function(storage) {
    $('#email').val(storage.user.email);
    $('#password').val(storage.user.password);
  });
});

function save() {
  var email = $('#email').val();
  var password = $('#password').val();
  if (!email || email === '') {
    showError('Le champ adresse e-mail est requis !');
    return;
  } else if (email.indexOf('@') === -1 || email.indexOf('.') === -1) {
    showError('L\'adresse email n\'est pas valide !');
    return;
  } else if (!password || password === '') {
    showError('Le champ mot de passe est requis !');
    return;
  }
  $.ajax({
    method: 'POST',
    url: 'https://api.wishing.space/auth/login',
    data: { username: email, password: password },
    dataType: 'json'
  }).done(function(loginResponse) {
    var user = loginResponse;
    user.email = email;
    user.password = password;
    chrome.storage.sync.set({user: user}, function() {
      showSuccess('Identifiants sauvegardés, vous pouvez maintenant fermer cette page et utiliser l\'extension ! ');
    });
  }).fail(function( jqXHR ) {
      showError(jqXHR.responseJSON.message);
  });
}

// Saves options to chrome.storage
$('#save').click(function() {
  save();
});

$('#password').keypress(function (e) {
  if (e.which === 13) {
    save();
    return false;
  }
});