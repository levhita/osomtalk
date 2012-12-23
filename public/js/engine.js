$(document).ready(function(){
	window.client = new Faye.Client(FrontEndConfig.url + "/faye");
	window.selected_index = -1;

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

	key('n', function(e) {
		openNewMessage();
		e.preventDefault();
	});

	key('c', function(e) {
		jumpToCompose();
		e.preventDefault();
	});

	key('r', function(e) {
		replySelected();
		e.preventDefault();
	});

	key('t', function() {
		selectTop();
	});

	key('j', function() {
		previousMessage();
	});

	key('k', function() {
		nextMessage();
	});

	key('h', function() {
		previousBookmark();
	});

	key('l', function() {
		nextBookmark();
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

	$('#newMessageModal').on('shown', function () {
  		$('#message_text_modal').focus();
	});

	$('#reply_input').bind('keypress', function(e) {
		if (e.keyCode == 13) {
			replyMessage();
			e.preventDefault();
		}
	});

	$('#message_text').bind('keypress', function(e) {
		if (e.keyCode === 10 || e.keyCode == 13 && e.ctrlKey) { // CTRL + ENTER
			sendMessageBody();
			e.preventDefault();
		}
	});

	$('#message_text').bind('keyup', function(e) {
		if ( e.keyCode === 27 ) { // ESC
			$('#message_text').blur();
			e.preventDefault();
		}
	});

	$('#message_text_modal').bind('keyup', function(e) {
		if ( e.keyCode === 27 ) { // ESC
			$('#message_text_modal').blur();
			e.preventDefault();
		}
	});

	$('#message_text_modal').bind('keypress', function(e) {
		if (e.keyCode === 10 || e.keyCode == 13 && e.ctrlKey) { // CTRL + ENTER
			sendMessageModal();
		}
	});
});


function sendMessageBody() {
	var text = $('#message_text').val();
	sendMessage(text, function () {
		$('#message_text').val('');
		$('#message_text').focus();
	});
}
function sendMessageModal() {
	var text = $('#message_text_modal').val();
	sendMessage(text,function () {
		$('#newMessageModal').modal('hide');
		$('#message_text_modal').val('');
		$('#message_text_modal').blur();
	});
}
function scrollToTop() {
	$('html, body').animate({scrollTop: 0}, 800);
}

function selectTop() {
	var past = window.selected_index;
	for(var i=room.messages.length-1; i >= 0; i--) {
		if(room.messages[i].user.type == "TWITTER" || room.messages[i].user.type == "ANONYMOUS") {
			$('#'+room.messages[i].id).addClass('selected');
			$('html, body').animate({scrollTop: $('#'+room.messages[i].id).offset().top- 200}, 500);
			window.selected_index = i;
			break;
		}
	}
	if(window.selected_index !== past && past !== -1) {
		$('#'+room.messages[past].id).removeClass('selected');
	}
}

function nextMessage() {
	if(window.selected_index==-1) {
		selectTop();
		return;
	}
	var past=window.selected_index;
	for(var i = window.selected_index+1; i < room.messages.length; i++) {
		if(room.messages[i].user.type == "TWITTER" || room.messages[i].user.type == "ANONYMOUS") {
			$('#'+room.messages[i].id).addClass('selected');
			$('html, body').animate({scrollTop: $('#'+room.messages[i].id).offset().top- 150}, 200);
			window.selected_index = i;
			break;
		}
	}
	if(window.selected_index !== past) {
		$('#'+room.messages[past].id).removeClass('selected');
	}
}

function previousMessage() {
	if(window.selected_index==-1) {
		selectTop();
		return;
	}
	var past=window.selected_index;
	for(var i = window.selected_index-1; i >= 0; i--) {
		if(room.messages[i].user.type == "TWITTER" || room.messages[i].user.type == "ANONYMOUS") {
			$('#'+room.messages[i].id).addClass('selected');
			$('html, body').animate({scrollTop: $('#'+room.messages[i].id).offset().top- 150}, 200);
			window.selected_index = i;
			break;
		}
	}
	if(window.selected_index !== past) {
		$('#'+room.messages[past].id).removeClass('selected');
	}
}


function jumpToCompose() {
	$('#message_text').focus();
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

/*function clickedLove(element) {
	var message_id = $(element).closest('.message').attr('id');
	loveMessage(message_id);
}*/
/*function loveMessage(message_id) {
	$.ajax({
		type: 'POST',
		url: '/love_message/' + view_config.room_id + '/' + message_id,
		data: {
			identifier: view_config.identifier,
			token: view_config.token
		},
		success: function(data) {}
	});
}*/

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

function replySelected() {
	if(window.selected_index==-1) {
		selectTop();
		return;
	}
	openReplyMessage(room.messages[window.selected_index].id);
}

function openReplyMessage(message_id) {
	$("#replyModal").modal('show');
	$("#message_id_input").val(message_id);
}

function openNewMessage() {
	$("#newMessageModal").modal('show');
	$("#message_text_modal").focus();
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
			$('#reply_input').val('');
			$('#reply_input').blur();
			$("#replyModal").modal('hide');
		}
	});
}


function sendMessage(text, success_callback) {
	if (text!=='') {
		var publication = window.client.publish('/messages_' + view_config.room_id, {
			text: text,
			identifier: view_config.identifier,
			token: view_config.token
		});
		publication.callback(success_callback);
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

$.fn.scrollTo = function( target, options, callback ){
  if(typeof options == 'function' && arguments.length == 2){ callback = options; options = target; }
  var settings = $.extend({
    scrollTarget  : target,
    offsetTop     : 50,
    duration      : 500,
    easing        : 'swing'
  }, options);
  return this.each(function(){
    var scrollPane = $(this);
    var scrollTarget = (typeof settings.scrollTarget == "number") ? settings.scrollTarget : $(settings.scrollTarget);
    var scrollY = (typeof scrollTarget == "number") ? scrollTarget : scrollTarget.offset().top + scrollPane.scrollTop() - parseInt(settings.offsetTop);
    scrollPane.animate({scrollTop : scrollY }, parseInt(settings.duration), settings.easing, function(){
      if (typeof callback == 'function') { callback.call(this); }
    });
  });
}

view_config.notifications = false;
view_config.previews = true;

