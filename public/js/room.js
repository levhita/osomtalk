(function (global){

	var Room = function(config) {
		config = config || {};
		var self = {};

		self._id			= config._id;
		self.name		= config.name || '';
		self.type 		= config.type || 'PUBLIC';
		self.admins		= config.admins || [];
		self.users_details  	= config.users_details || [];
		self.messages 	= config.messages || [];

		/** This one should be the one **/
		self.getData = function () {
			return {
				_id: 		self._id,
				name: 		self.name,
				type: 		self.type,
				admins:  	self.admins,
				users_details:  	self.users_details
			}
		};

		self.addMessage = function(data) {
			var message = {
				_id: data._id,
				text: data.text,
				type: data.type,
				user_id: data.user_id,
				replies: []
			}
			
			self.messages.push(message);
			self.renderMessage(message);
			
			if ( message.type == 'USER' ){
				var user_index = self.getUserIndex(message.user_id);
				self.showNotification(self.name, self.users_details[user_index].username, message.text, 5000, function(){});
			} else if(message.type == 'SYSTEM') {
				self.showNotification(self.name, 'OsomTalk', message.text, 3000, function(){});		
			}
		
		};

		self.showNotification= function (title, user, text, time, onclick) {
			if (view_config.notifications == true) { // Notifications active
				var text = (text >30)? text.substring(0,20) + '...': text;
				var notification = window.webkitNotifications.createNotification(
					'/img/favicon.png', self.name, user +": " + text);
				notification.ondisplay = function() {
					setTimeout(function() {
						notification.cancel();
					}, 5000);
				};
				notification.onclick = onclick;
				notification.show();
			}
		} 
		
		self.getMessageIndex = function(message_id) {
			for (var i = 0; i < self.messages.length; i++) {
				if(self.messages[i]._id==message_id) {
					return i;
				}
			}
			return false;
		}

		self.getUserIndex = function(user_id) {
			for (var i = 0; i < self.users_details.length; i++) {
				if(self.users_details[i].user_id==user_id) {
					return i;
				}
			}
			return false;
		}

		self.deleteMessage = function(message_id) {
			var index = self.getMessageIndex(message_id);
			if (index !== false) {
				self.messages.splice(index, 1);
				return true;
			}
			return false;
		}

		self.getPreview = function(message_id) {
			var index = self.getMessageIndex(message_id);
			if (index !== false) {
				text = self.messages[index].text;
				var previewsHTML = utils.getPreviewsHTML(text, message_id);
			}
			return previewsHTML;
		}

		self.fillAllPreviews = function() {
			for (var i = 0; i < self.messages.length; i++) {
				var previewsHTML = utils.getPreviewsHTML(self.messages[i].text, self.messages[i]._id);
				if ( previewsHTML !== '') {
					escaped_message_id = self.messages[i]._id.replace(/([ #;&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');
					$("#" + escaped_message_id).children(".preview_container").html(previewsHTML);	
				}
			}
		}

		self.renderMessage = function (message) {
			var previewsHTML = utils.getPreviewsHTML(message.text, message._id);
			var date = new Date(parseInt(message._id.toString().slice(0,8), 16) * 1000);
			var date = utils.getLocaleShortDateString(date) + " " + date.toLocaleTimeString();
			if(message.type == "USER") {
				var user = self.users_details[self.getUserIndex(message.user_id)];
				var escapedName = user.username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
			}
			var string = '';
			var toggle_preview_button ='';
			var delete_button = '';
			
			if (previewsHTML !== '') {
				toggle_preview_button = '<a class="toggle_previews btn btn-mini btn-inverse" onclick="tooglePreview(\'' + message._id + '\');"><i class="icon-eye-open icon-white"></i></a>';
			}
			
			if (message.user_id === view_config.user_id) {
				delete_button = ' <a class="delete_button btn btn-mini btn-inverse" onclick="deleteMessage(\'' + message._id + '\');"><i class="icon-remove icon-white"></i></a>';
			}
			var reply_button = ' <a class="reply_button btn btn-mini btn-inverse" onclick="openReplyMessage(\'' + message._id + '\');"><i class="icon-reply icon-white"></i></a>';
			if(message.type=='USER') {
				if( user.type == 'ANONYMOUS') {
					string = '<div class="message" id="'+message._id+'"><div class="info"><span class="user">' + escapedName + '</span> <span class="muted">(Anonymous)</span><div class="time">' + date + '</div></div><div class="utility">' + toggle_preview_button + delete_button + reply_button + '</div><div class="text">' + utils.markdown(message.text) +'</div>';
				} else if( user.type=='TWITTER') {
					string = '<div class="message" id="'+message._id+'"><div class="info"><span class="user">' + escapedName + '</span> <a class="muted" target="_BLANK" href="http://twitter.com/'+user.username+'">(twitter)</a><div class="time">' + date + '</div></div><div class="utility">' + toggle_preview_button + delete_button + reply_button + '</div><div class="text">' + utils.markdown(message.text) +"</div>";
				}
			} else if(message.type=='OFFICIAL') {
				string = '<div class="message" id="'+message._id+'"><div class="info"><span class="user">OsomTalk</span> <span class="muted">(Official)</span><div class="time">' + date + '</div></div><div class="utility">' + toggle_preview_button + '</div><div class="text">' + utils.markdown(message.text) +'</div>';
			} else if(message.type=='SYSTEM') {
				var escapedText = message.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
				string = '<div class="message system" id="'+message._id+'"><span class="time">' + date + ':</span> ' + escapedText +'</div>';
			}
			
			if ( message.type!='SYSTEM') {
				if(previewsHTML !== '') {
					string += '<div class="preview_container">';
				}
				if(view_config.previews) {
					string += previewsHTML;
				} 
				if(previewsHTML !== '') {
					string += '</div>';
				}
				string += '<div class="replies">';
				if(message.replies.length > 0 ) {
					string += self.renderReplies(message.replies);
				}
				string += '</div>';
				
				string += '</div>';
				
				$('#messages').prepend(string);
			} else {
				$('#messages').prepend(string);
			}
		}

		self.renderUser = function (user) {
			var escapedName = user.username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
			var type = "";
			if(user.type=='TWITTER') {
				type = ' <a class="muted" target="_BLANK" href="http://twitter.com/' + user.username + '">(@' + user.username + ')</a>';
			} else {
				type = ' <span class="muted">(Anonymous)</span>';
			}
			$('#users').prepend('<div class="user" id="user_' + user.user_id + '">' + escapedName + type + '</div>');
		}

		self.renderReplies = function (replies) {
			var text = '';
			/** Render Replies **/
			for(var i = 0; i < replies.length; i++) {
				var user = self.users_details[self.getUserIndex(replies[i].user_id)];
				var user_text = user.username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
				user_text = (user.type==="TWITTER")? "@"+user_text: user_text + '<span class="muted">(Anonymous)</span>';
				var date = new Date(replies[i].timestamp * 1000);
				date = utils.getLocaleShortDateString(date) + " " + date.toLocaleTimeString();

				text += '<div class="reply" id="reply-'+replies[i]._id+'">'
					  + replies[i].text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
					  + ' <div class="reply-info"><span class="reply-user">' + user_text + '</span>'
					  + ' <span class="reply-time">' + date + '</span></div>'
					  + '</div>';
			}	
			return text;
		}
		

		self.renderMessages = function() {
			for(var i = 0; i < self.messages.length; i++) {
				self.renderMessage(self.messages[i]);
			}
		}

		self.renderUsers = function() {
			$('#users').html('');
			for(var i = 0; i < self.users_details.length; i++) {
				self.renderUser(self.users_details[i]);
			}
		}
		
		/** Connections with web services **/
		/** Gets full room data **/
		self.getRoomData = function(callback){
			$.ajax({
				url: '/rooms/get/'+ self._id,
				success: function(data) {
					self.name = data.name;
					callback();
				}
			});
		};
		
		self.getMessagesData = function(callback){
			$.ajax({
				url: '/rooms/get_messages/'+ self._id,
				success: function(data) {
					self.messages = data;
					callback();
				}
			});
		};

		self.getUsersData = function(callback){
			$.ajax({
				url: '/rooms/get_users/'+ self._id,
				success: function(data) {
					self.users_details = data;
					callback();
				}
			});
		};

		self.subscribe = function(client) {
			client.subscribe('/server_messages_'+ self._id, function(message) {
				self.addMessage(message);
			});
			client.subscribe('/server_actions_'+ self._id, function(data) {
				if(data.action=='update_users') {
					self.getUsersData(self.renderUsers);
				}
				if(data.action=='update_loves') {
					escaped_message_id = data.message._id;
					$("div[id=" + escaped_message_id + "] .loves .counter").html(data.message.loves.length);
				}
				if(data.action=='update_message_replies') {
					var repliesHtml = room.renderReplies(data.replies);
					$("div[id=" + data.message_id + "] .replies").html(repliesHtml);
				}
				if(data.action=='delete_message') {
					escaped_message_id = data.message_id;
					$("div[id=" + escaped_message_id + "]").remove();
					room.deleteMessage(data.message_id);
				}
			});
		}

		return self;
	};

	global.Room = Room;
}(typeof window  === 'undefined' ? exports : window));