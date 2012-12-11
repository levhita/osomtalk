$(document).ready(function(){
	window.client = new Faye.Client(FrontEndConfig.url + "/faye");
	
	var room_id = $('#room_id').text();
	room = new Room({id:room_id});
	room.subscribe(window.client);
	
	room.getRoomData(function (){
		room.renderRoom();
	});
	
	
	/** MarkDown Configuration **/
	marked.setOptions({
	  gfm: true,
	  pedantic: false,
	  sanitize: true,
	});
	
	/** 
	 * Send message when plain enter is pressed, on Shift + Enter
	 * adds a new line.
	 **/
	 $('#message_input').bind('keypress', function(e) {
	 	if (e.keyCode == 13 && e.shiftKey) {
	 		sendMessage();
	 		e.preventDefault();
	 	}
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
});

function sendMessage() {
	var room_id = $('#room_id').text();
	var text = $('#message_input').val();
	
	if (text!=='') {
		var publication = window.client.publish('/messages_' + room_id, {
			text: text,
			identifier: $('#identifier').val(),
			token: $('#token').val()
		});
		publication.callback(function() {
  			$('#message_input').val('');
			$('#message_input').focus();
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
  			} else if(error.message=="BLOCKED_FLOODING") {
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

function takeName() {
	var username = $("#username").val();
	$.ajax({
		url: '/user/take/',
		data: {username: username},
		success: function(data) {
			if(data.error) {
				if (data.error=="NAME_TAKEN") {
					$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">×</button><strong>Warning!</strong> Mmmm...that name is already taken.</div>');
  				} else if(data.error=="TOO_LONG"){
  					$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">×</button><strong>Warning!</strong> That username is too long, the limit is 12 chars</div>');	
  				} else if(data.error=="EMPTY"){
  					$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">×</button><strong>Warning!</strong> Your name is empty and you should feel bad</div>');
  				}

  				$('#alert_place_holder').fadeIn();
  				setTimeout(function() {
 					$('#alert_place_holder').fadeOut();
  				} , 3000); 
			} else {
				location.reload();
			}	
		}
	});
};