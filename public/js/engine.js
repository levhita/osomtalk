$(document).ready(function(){
	//window.client = new Faye.Client('http://localhost:3000/faye');
	window.client = new Faye.Client('http://osomtalk.jit.su/faye');
	
	
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
	 	if (e.keyCode == 13 && !e.shiftKey) {
	 		sendMessage();
	 		e.preventDefault();
	 	}
	 });

	 $('#hide_previews').bind('click', function(e) {
	 	console.log('hidding');
	 	$(".toggle_previews").html('<i class="icon-circle-arrow-down"></i> Show Previews');
	 	$(".previews").hide();
	 });

	 $('#show_previews').bind('click', function(e) {
	 	console.log('showing');
	 	$(".toggle_previews").html('<i class="icon-circle-arrow-up"></i> Hide Previews');
	 	$(".previews").show();
	 });
});

function sendMessage() {
	var room_id = $('#room_id').text();
	var text = $('#message_input').val();
	if (text!=='') {
		window.client.publish('/messages' + room_id, {
			data: {
				text: $('#message_input').val()
			}
		});
		$('#message_input').val('');
		$('#message_input').focus();
	}
}

function activateNotifications () {
	console.log('Activating notifications');
	if (window.webkitNotifications) {
  		console.log("Notifications are supported!");
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
	}
};

function tooglePreview(element){
	var div = $(element).parent();
	if ( $(element).html() === '<i class="icon-circle-arrow-up"></i> Hide Previews') {
		div.children(".previews").hide();	
		$(element).html('<i class="icon-circle-arrow-down"></i> Show Previews');
	} else {
		div.children(".previews").show();	
		$(element).html('<i class="icon-circle-arrow-up"></i> Hide Previews');
	}
}

/*function takeName() {
	var username = $("#username").val();
}*/