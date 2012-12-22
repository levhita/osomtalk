$(document).ready(function(){
	window.client = new Faye.Client(FrontEndConfig.url + "/faye");
	

	room = new Room({id:view_config.room_id});
	room.subscribe(window.client);
	
	room.getRoomData(function (){
		room.renderRoom();
	});
	
	pingBack();

	/** MarkDown Configuration **/
	marked.setOptions({
		gfm: true,
		pedantic: false,
		sanitize: true,
	});
	
	$("#previews_button button").bind('click', function() {
		if(this.value==0) {
			view_config.previews = false;
			hideAllPreviews();
		} else {
			view_config.previews = true;
			showAllPreviews();
		}
	});

	$("#notifications_button button").bind('click', function() {
		if(this.value==0) {
			view_config.notifications = false;
		} else {
			if (window.webkitNotifications) {
				if (window.webkitNotifications.checkPermission() == 0) { // 0 is PERMISSION_ALLOWED
					view_config.notifications = true;
				} else {
					window.webkitNotifications.requestPermission( function(){
						if (window.webkitNotifications.checkPermission() == 0) {
							view_config.notifications = true;
						} else {
							$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">×</button><strong>Error!</strong> You have previously blocked notifications from OsomTalk.</div>');
							$('#alert_place_holder').fadeIn();
							setTimeout(function() {
								$('#alert_place_holder').fadeOut();
							} , 10000); 
							view_config.notifications = false;
						}
						updateUtility();
					});
				}
			} else {
				$('#alert_place_holder').html('<div class="alert"><button type="button" class="close" data-dismiss="alert">×</button><strong>Error!</strong> Your Browser doesn\'t support notifications.</div>');
				$('#alert_place_holder').fadeIn();
				setTimeout(function() {
					$('#alert_place_holder').fadeOut();
				} , 3000); 
			}
		}
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

	window.editor = new EpicEditor(opts).load(function () {
		$( this.getElement('editor').body ).bind('paste', function() {
			setTimeout(function () {
				window.editor.sanitize();
			}, 100);
		});
	});

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


	if (window.webkitNotifications) {
		if (window.webkitNotifications.checkPermission() == 0) {
			view_config.notifications = true;
		}
	}
	updateUtility();

	$('#replyModal').on('shown', function () {
  		$('#reply_input').focus();
	});

	$('#reply_input').bind('keypress', function(e) {
		if (e.keyCode == 13) {
			replyMessage();
			e.preventDefault();
		}
	});
});



function scrollToTop() {
	$('body,html').animate({scrollTop:0},800);
}

function newMessage() {
	window.editor.focus();
	scrollToTop();
}

function pingBack() {
	$.ajax({
		url: '/user/ping/'+ view_config.room_id,
		success: function(data) {
			setTimeout(function() { pingBack()}, 60000);
		}
	}); 
}

function clickedLove(element) {
	var message_id = $(element).closest('.message').attr('id');
	loveMessage(message_id);
}
function loveMessage(message_id) {
	$.ajax({
		type: 'POST',
		url: '/love_message/' + view_config.room_id + '/' + message_id,
		data: {
			identifier: view_config.identifier,
			token: view_config.token
		},
		success: function(data) {}
	});
}

function deleteMessage(message_id) {
	$.ajax({
		type: 'POST',
		url: '/delete_message/' + view_config.room_id + '/' + message_id,
		data: {
			identifier: view_config.identifier,
			token: view_config.token
		},
		success: function(data) {}
	});
}

function openReplyMessage(message_id) {
	$("#replyModal").modal('show');
	$("#message_id_input").val(message_id);
}

function replyMessage() {
	var message_id  = $("#message_id_input").val();
	var text 		= $("#reply_input").val();
	
	$.ajax({
		type: 'POST',
		url: '/reply_message/' + view_config.room_id + '/' + message_id,
		data: {
			identifier: view_config.identifier,
			token: view_config.token,
			text: text
		},
		success: function(data) {
			$("#replyModal").modal('hide');
		}
	});
}


function sendMessage(text) {
	if (text!=='') {
		var publication = window.client.publish('/messages_' + view_config.room_id, {
			text: text,
			identifier: view_config.identifier,
			token: view_config.token
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

function tooglePreview(message_id){
	escaped_message_id = message_id.replace(/([ #;&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');
	if ( $("#" + escaped_message_id).children('.preview_container').html() == '' ) {
		$("#" + escaped_message_id).children('.preview_container').html( room.getPreview(message_id));
		$("#" + escaped_message_id).find('.toggle_previews').html('<i class="icon-eye-open icon-white"></i>');
	} else {
	 	$("#" + escaped_message_id).children('.preview_container').html('');
		$("#" + escaped_message_id).find('.toggle_previews').html('<i class="icon-eye-close icon-white"></i>');
	}
}
function hideAllPreviews() {
	$(".toggle_previews").html('<i class="icon-eye-close icon-white"></i>');
	$(".preview_container").html('');
}

function showAllPreviews() {
	$(".toggle_previews").html('<i class="icon-eye-open icon-white"></i>');
	room.fillAllPreviews();
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

function updateUtility() {
	if(view_config.notifications) {
		$('#notifications_button button[value=1]').addClass('active');
		$('#notifications_button button[value=0]').removeClass('active');
	}else {
		$('#notifications_button button[value=1]').removeClass('active');
		$('#notifications_button button[value=0]').addClass('active');
	}

	if(view_config.previews) {
		$('#previews_button button[value=1]').addClass('active');
		$('#previews_button button[value=0]').removeClass('active');
	}else {
		$('#previews_button button[value=1]').removeClass('active');
		$('#previews_button button[value=0]').addClass('active');
	}
}

view_config.notifications = false;
view_config.previews = true;

