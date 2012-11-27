$(document).ready(function(){
	window.client = new Faye.Client('http://osomtalk.jit.su/faye');
	//window.client = new Faye.Client('http://localhost:3000/faye');
	
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
	});

function sendMessage() {
	var room_id = $('#room_id').text();
	var text = $('#message_input').val();
	if(text!=='') {
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
		    window.webkitNotifications.createNotification(
	        '/img/favicon.png', 'OsomTalk', 'notifications active');
		} else {
			window.webkitNotifications.requestPermission();
		}
	}
};