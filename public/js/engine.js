$(document).ready(function(){
	window.client = new Faye.Client('http://192.168.37.80:8000/faye');
	
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