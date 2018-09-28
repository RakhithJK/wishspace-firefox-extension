/*Lint preferences*/
/*global $:false */
/*global chrome:false */

function hashCode(s){
  return s.split('').reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a;},0);
}

// récupération de la donnée depuis le cache si elle existe
function getData(name, value, storage) {
  var pageid = $('input[name="pageid"]').val();
  if (storage && storage.lastinfo && storage.lastinfo[pageid] && storage.lastinfo[pageid][name] && storage.lastinfo[pageid][name].length>0) {
    return storage.lastinfo[pageid][name];
  } else if (value && value.length>0) {
    return value;
  } else {
    return '';
  }
}

function showError(message, css) {
  $('#status').hide();
  $('#status').html('');
  $('#wishForm').hide();
  $('#error-content').html(message);
  if (css) { $('#error-content').attr('class', 'alert alert-'+css);}
  else { $('#error-content').attr('class', 'alert alert-danger');}
  $('#error').show();
  $('#login').show();
}

function showStatus(message) {
  $('#error').hide();
  $('#status').html(message);
  $('#status').show();
}

function gravatarImage(personne, size) {
  if (!personne) { return; }
  var url = '';
  if (personne.gravstyle === 'social' && personne.imageurl) {
    url = personne.imageurl;
  } else if (personne.gravstyle === 'custom') {
    url = 'https://image.wishing.space/user-' + personne.hashcode + '.jpg';
  } else {
    url = 'http://www.gravatar.com/avatar/'+personne.gravatar+'?r=pg&d=';
    if (personne.gravstyle) {
        url += personne.gravstyle;
    } else {
        url += 'identicon';
    }
    if (size) {
        url += '&s='+size;
    }
  }
  return url;
}


// Récupération des informations du souhait à créer
function processPage(pUser) {
    if (!pUser || !pUser.token || !pUser.id) {
      showError('Erreur interne, mauvais paramètres...');
      return;
    }
    $('#user-avatar').attr('src', gravatarImage(pUser, 42));
    $('#user-avatar').attr('title', 'Connecté en tant que ' + pUser.prenom+' '+pUser.nom);
    $('#user-avatar').show();
    $('[data-toggle="tooltip"]').tooltip();
    // on cache et affiche les éléments nécessaires
    $('#error').hide();
    $('#status').hide();
    $('#wishForm').show();
    $('#footer-info').show();
    // Récupération de l'url de la page courante
    chrome.tabs.query({active: true, currentWindow: true }, function(tabs) {
      var tab = tabs[0];
      chrome.storage.sync.get({
        lastinfo: {},
      }, function(storage) {
        var pageid = hashCode(tab.url);
        $('input[name="pageid"]').val(pageid);
        $('input[name="nom"]').val(
          getData('nom', tab.title, storage)
        );
        $('input[name="lien"]').val(
          getData('lien', tab.url, storage)
        );
        $('input[name="category"]').val(
          getData('category', '', storage)
        );
        $('input[name="prix"]').val(
          getData('prix', '', storage)
        );
        $('input[name="happiness"]').val(
          getData('happiness', '', storage)
        );

        // Récupération des informations présente dans la page (DOM)
        chrome.tabs.executeScript({file:'/js/tab.js'}, function(results) {
            if (!results) {
                return; // error
            }
            var result = results[0];
            var nom = getData('nom', result.title, storage);
            if (nom.length>0) {
              $('input[name="nom"]').val(nom);
            }
            var imageurl = getData('image', result.image, storage);
            if (imageurl.length>0) {
              $('input[name="image"]').val(imageurl);
              $('#image').attr('src', imageurl).show();
            }
            var lien = getData('lien', result.url, storage);
            if (lien.length>0) {
              $('input[name="lien"]').val(lien);
            }
            $('input[name="info-origin"]').val(result.description);
            $('textarea[name="info"]').html(
              getData('info', '', storage)
            );
        });

        // Récupération de la liste des listes partagées
        $.ajax({
          method: 'GET',
          url: 'https://api.wishing.space/user/shared/list',
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          headers: {'Authorization': 'Bearer ' + pUser.token}
        }).done(function(sharedResponse) {
          sharedResponse.sort(function(a, b){
            return a.name.localeCompare(b.name);
          });
          $.each(sharedResponse, function(index, shared){
            $('#my-list').append('<option value="'+shared.hashcode+'#'+shared.id+'">'+
              shared.name+'</option>'
            );
          });
          $.ajax({
            method: 'GET',
            url: 'https://api.wishing.space/user/follow/list?useronly=true',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            headers: {'Authorization': 'Bearer ' + pUser.token}
          }).done(function(followResponse) {
            followResponse.sort(function(a, b){
              if (!a.prenom) {
                return -1;
              }
              return a.prenom.localeCompare(b.prenom);
            });
            $.each(followResponse, function(index, follow){
              if (follow.prenom) {
                $('#follow-list').append(
                  '<option value="'+follow.hashcode+'#'+follow.id+'">'+
                  follow.prenom+' '+follow.nom+'</option>'
                );
              }
            });
          });
        }).fail(function( jqXHR ) {
          showError('Erreur lors du chargement : ' + jqXHR.responseJSON.message);
        });
      });
    });
}

// connexion à l'API Wishing.space
function loginAndProcess(pUser) {
    $.ajax({
      method: 'POST',
      url: 'https://api.wishing.space/auth/login',
      data: { username: pUser.email, password: pUser.password },
      dataType: 'json',
    }).done(function(loginResponse) {
      var user = loginResponse;
      user.email = pUser.email;
      user.password = pUser.password;
      chrome.storage.sync.set({
          user: user
      }, function() {
        processPage(user);
      });
    }).fail(function( jqXHR ) {
        showError('Erreur lors de la connexion : ' + jqXHR.responseJSON.message);
    });
}

// Connexion à l'API Wishing.space si nécessaire
function checkConnexionAndProcess(pUser) {
  showStatus('Chargement...');
  var headers = {
      'content-type': 'application/json'
  };
  // injection du header d'authentification nécessaire (token)
  if (pUser.token) {
      headers.Authorization = 'Bearer ' + pUser.token;
  }
  $.ajax({
    method: 'GET',
    url: 'https://api.wishing.space/auth/check',
    dataType: 'json',
    headers: headers
  }).done(function(checkResponse) {
    if (checkResponse.logged !== 1) {
      loginAndProcess(pUser);
    } else {
      processPage(pUser);
    }
  }).fail(function( jqXHR ) {
    if(jqXHR.status === 401) { // session expired
      loginAndProcess(pUser);
    } else {
      showError('Erreur lors du l\'authentification : ' + jqXHR.responseJSON.message);
    } 
  });
}

function connect() {
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
  var user = {
    email: email,
    password: password
  };
  checkConnexionAndProcess(user);
}

/******************************************************************
 *
 * A L'OUVERTURE LA POPUP
 *
 ******************************************************************/
$( document ).ready(function() {
  // récupéaration des options de l'extension
  chrome.storage.sync.get({
    user: {}
  }, function(storage) {
    if (!storage || !storage.user.email || storage.user.email === '') {
      showError('Avant d\'utiliser cette extension vous devez saisir vos identifiants.', 'warning');
      $('#ok').hide();
    } else {
      // Connexion à l'API Wishing.space
      checkConnexionAndProcess(storage.user);
    }
  });

  // au clique sur se connecter
  $('#login').click(function(){
    connect();
  });

  // au clique sur le bouton plus de caractéristique
  $('#show-more').click(function(){
    $(this).hide();
    $('#show-less').show();
    $('#show-more-content').show();
    // récupéaration des options de l'extension
    chrome.storage.sync.get({
      user: {},
    }, function(storage) {
      $('textarea[name="info"]').html(
        getData('info', $('input[name="info-origin"]').val(), storage)
      );
    });
    return false
  });
  
  // au clique sur le bouton moins de caractéristique
  $('#show-less').click(function(){
    $(this).hide();
    $('#show-more').show();
    $('#show-more-content').hide();
    return false
  });

  // au clique sur ajouter
  $('#ok').click(function(){
    // récupéaration des options de l'extension
    chrome.storage.sync.get({
      user: {},
    }, function(storage) {
      var validationErrors = [];
      var payload = {
        nom: $('input[name="nom"]').val()
      };
      var typeList = $('input[name="typeList"]').val();
      var currentList, listinfo;
      if (typeList === 'follow') {
        currentList = $('#follow-list').val();
        if (currentList && currentList.indexOf('#') !== -1) {
          listinfo = currentList.split('#');
          payload.userid = listinfo[1];
        } else if (currentList === '') {
          validationErrors.push('Veuillez choisir une liste de destination');
        } else {
          validationErrors.push('Impossible de récupérer la liste de destination');
        }
      } else {
        currentList = $('#my-list').val();
        if (currentList && currentList.indexOf('#') !== -1) {
          listinfo = currentList.split('#');
          payload.sharedid = listinfo[1];
        } else if (currentList === '') {
          validationErrors.push('Veuillez choisir une liste de destination');
        }
        payload.userid = storage.user.id;
      }
      if (!payload.nom || payload.nom === '') {
        validationErrors.push('Le nom est obligatoire !');
      }
      var image = $('input[name="image"]').val();
      if (image && image.length>6) {
        payload.images = [image];
      }
      var lien = $('input[name="lien"]').val();
      if (lien && lien.length>6) {
        payload.links = [lien];
      }
      var lientype = $('input[name="lientype"]:checked').val();
      if (lientype) {
        payload.lientype = lientype;
      }
      var category = $('input[name="category"]').val();
      if (category && category.length > 0) {
        payload.category = category;
      }
      var prix = $('input[name="prix"]').val();
      if (prix !== '' && prix>=0) {
        payload.prix = prix;
      }
      var info = $('textarea[name="info"]').val();
      if (info && info.length>=0) {
        payload.info = info;
      }
      var happiness = $('input[name="happiness"]').val();
      if (happiness !== '' && happiness>0) {
        payload.happiness = happiness;
      }
      if (validationErrors.length !== 0) {
        $('#validation-errors').html('');
        $.each(validationErrors, function(index, error){
          $('#validation-errors').append(
            '<div>'+error+'</div>'
          );
        });
        $('#validation-errors').show();
      } else {
        $('#validation-errors').hide();
        $.ajax({
          method: 'POST',
          url: 'https://api.wishing.space/wish/add',
          data: JSON.stringify(payload),
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          headers: {'Authorization': 'Bearer ' + storage.user.token},
          async: false
        }).done(function( data ) {
          // clean du cache
          chrome.storage.sync.get({
            lastinfo: {},
          }, function(storage) {
            var lastinfo = storage.lastinfo;
            var pageid = $('input[name="pageid"]').val();
            if (lastinfo[pageid]) {
              lastinfo[pageid] = {};
              chrome.storage.sync.set({
                lastinfo: lastinfo
              });
            }
          });
          // affichage page de résultat
          $('#wishForm').hide();
          $('#ok').hide();
          $('#footer-info').hide();
          var url='https://www.wishing.space';
          if (payload.sharedid) {
            url += '/'+listinfo[0]+'/'+data.id;
          } else if (payload.userid !== storage.user.id) {
            url += '/'+listinfo[0]+'/'+data.id;
          } else {
            url += '/'+storage.user.hashcode+'/'+data.id;
          }
          $('#wish-added-link').attr('href', url);
          $('#wish-added').show();
        }).fail(function( jqXHR ) {
          $('#validation-errors').html('Erreur lors de l\'ajout du souahit : ' + jqXHR.responseJSON.message);
          $('#validation-errors').show();
        });
      }
    });
  });

  // quand on clique sur mes listes
  $('#mine').click(function () {
    $(this).toggleClass('text-info');
    $('#follow').toggleClass('text-info');
    $('input[name="typeList"]').val('mine');
    $('#follow-list').hide();
    $('#my-list').show();
  });

  // quand on clique sur mes abonnements
  $('#follow').click(function () {
    $(this).toggleClass('text-info');
    $('#mine').toggleClass('text-info');
    $('input[name="typeList"]').val('follow');
    $('#follow-list').show();
    $('#my-list').hide();
  });

  // quand on appui sur entrer dans le champ mot de passe
  $('#password').keypress(function (e) {
    if (e.which === 13) {
      connect();
      return false;
    }
  });

  // Lors de la copie d'une url d'image, on affiche la preview
  $('input[name="image"]').change(function(){ 
    if ($( this ).val() === '') {
      $('#image').hide();
    } else {
      $('#image').attr('src', $( this ).val()).show();
    }
  });

  // Le boutton fermer, ferme la popup...
  $('#close').click(function(){ window.close(); });

  // Au changement de valeur d'un champ
  $('input, textarea').change(function(){
    var name = $(this).attr('name');
    if (name === 'email' || name === 'password') {
      return;
    }
    var value ='';
    if ($(this).type === 'textarea') {
      value = $(this).html();
    } else {
      value = $(this).val();
    }
    chrome.storage.sync.get({
      lastinfo: {},
    }, function(storage) {
      var lastinfo = storage.lastinfo;
      var pageid = $('input[name="pageid"]').val();
      //console.log('pageid: '+ pageid +', changed : ' + name + ', value: ' + value + ', lastinfo:' + JSON.stringify(lastinfo));
      if (!lastinfo[pageid]) {
        lastinfo[pageid] = {};
      }
      lastinfo[pageid][name] = value;
      chrome.storage.sync.set({
        lastinfo: lastinfo
      });
    });
  });
});
