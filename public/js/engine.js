$(document).ready(function(){
	window.client = new Faye.Client(FrontEndConfig.url + "/faye");
	
	var room_id = $('#room_id').text();
	room = new Room({id:room_id});
	room.subscribe(window.client);
	
	room.getRoomData(function (){
		room.renderRoom();
	});
	
	pingBack(room_id);

	/** MarkDown Configuration **/
	marked.setOptions({
		gfm: true,
		pedantic: false,
		sanitize: true,
	});
	
	$('#username').bind('keypress', function(e) {
		if (e.keyCode == 13) {
			takeName();
			e.preventDefault();
		}
	});

	$('#hide_previews').bind('click', function(e) {
		$(".toggle_previews").html('<i class="icon-circle-arrow-down icon-white"></i> Show Media');
		$(".previews").hide();
	});

	$('#show_previews').bind('click', function(e) {
		$(".toggle_previews").html('<i class="icon-circle-arrow-up icon-white"></i> Hide Media');
		$(".previews").show();
	});
	$('#notifications_button').bind('click', function(e) {
		activateNotifications();
	});


	var opts = {
		container: 'epiceditor',
		basePath: '',
		clientSideStorage: false,
		localStorageName: 'epiceditor',
		parser: marked,
		file: {
			name: 'epiceditor',
			defaultContent: '',
			autoSave: 100
		},
		theme: {
			base:'/css/epic-themes/base/epiceditor.css',
			preview:'/css/epic-themes/preview/preview-dark.css',
			editor:'/css/epic-themes/editor/epic-light.css'
		},
		focusOnLoad: true,
		shortcut: {
			modifier: 18,
			fullscreen: 70,
			preview: 80,
			edit: 79,
			send: 13,
		},
		send_callback: sendMessage
	}

	window.editor = new EpicEditor(opts).load();

	key('n', function() {
		newMessage();
	});

	key('t', function() {
		scrollToTop();
	});

	key('j', function() {
		previousMessage();
	});

	key('k', function() {
		nextMessage();
	});

	key('l', function() {
		loveMessage();
	});

});

function scrollToTop() {
	$('body,html').animate({scrollTop:0},800);
}

function newMessage() {
	window.editor.focus();
	scrollToTop();
}

function pingBack(room_id) {
	$.ajax({
		url: '/user/ping/'+ room_id,
		success: function(data) {
			setTimeout(function() { pingBack(room_id)}, 60000);
		}
	});	
}

function sendMessage(text) {
	var room_id = $('#room_id').text();
	
	if (text!=='') {
		var publication = window.client.publish('/messages_' + room_id, {
			text: text,
			identifier: $('#identifier').val(),
			token: $('#token').val()
		});
		publication.callback(function() {
			window.editor.empty();
			window.editor.focus();
		});
		publication.errback(function(error) {
			if(error.message=="BLOCKED_TYPING") {
				$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">×</button><strong>Warning!</strong> Slow down cowboy!, you don\'t want spam everyone do you?</div>');
				$('#alert_place_holder').fadeIn();
				setTimeout(function() {
					$('#alert_place_holder').fadeOut();
				} , 3000); 
			} else if (error.message=="BLOCKED_LARGE" ){
				$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">×</button><strong>Warning!</strong> Your message is too long and you should feel bad.</div>');
				$('#alert_place_holder').fadeIn();
				setTimeout(function() {
					$('#alert_place_holder').fadeOut();
				} , 3000);
			} else if(error.message=="BLOCKED_FLOODING" || error.message=="NO_PERMISSION") {
				window.location.href="/"
			}
		});
	}
}

function activateNotifications () {
	if (window.webkitNotifications) {
  		if (window.webkitNotifications.checkPermission() == 0) { // 0 is PERMISSION_ALLOWED
  			var notification = window.webkitNotifications.createNotification(
  				'/img/favicon.png', 'OsomTalk', 'Notifications are already active');
  			notification.ondisplay = function() {
  				setTimeout(function() {
  					notification.cancel();
  				}, 5000);
  			};
  			notification.show();
  		} else {
  			window.webkitNotifications.requestPermission();
  		}
  	} else {
  		$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">×</button><strong>Error!</strong> Your Browser doesn\'t support notifications.</div>');
  		$('#alert_place_holder').fadeIn();
  		setTimeout(function() {
  			$('#alert_place_holder').fadeOut();
  		} , 3000); 
  	}
  };

  function tooglePreview(element){
  	var div = $(element).parent();
  	if ( $(element).html() === '<i class="icon-circle-arrow-up icon-white"></i> Hide Media') {
  		div.children(".previews").hide();	
  		$(element).html('<i class="icon-circle-arrow-down icon-white"></i> Show Media');
  	} else {
  		div.children(".previews").show();	
  		$(element).html('<i class="icon-circle-arrow-up icon-white"></i> Hide Media');
  	}
  }

  $(function() {
  	$(window).scroll(function() {
  		if($(this).scrollTop() != 0) {
  			$('#toTop').fadeIn();	
  		} else {
  			$('#toTop').fadeOut();
  		}
  	});

  	$('#toTop').click(function() {
  		scrollToTop();
  	});	
  });