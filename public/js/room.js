(function (global){

	var Room = function(config) {
		config = config || {};
		var self = {};

		self._id			= config._id;
		self.name		= config.name || '';
		self.type 		= config.type || 'PUBLIC';
		self.admins		= config.admins || [];
		self.users  	= config.users || [];
		self.users_ids 	= config.users_ids || [];
		self.messages 	= config.messages || [];

		/** This one should be the one **/
		self.getData = function () {
			return {
				_id: 		self._id,
				name: 		self.name,
				type: 		self.type,
				admins:  	self.admins,
				users_ids:  self.users_ids
			}
		};

		self.getMessages = function () {
			return self.messages;
		};

		self.setMessages = function(messages) {
			self.messages = messages;
		}

		self.setReplies = function(replies) {
			self.replies = replies;
		}

		self.userExists = function(user_id) {
			return (self.users_ids[user_id]!==undefined);
		}

		self.getUsersIds = function () {
			var ids = []
			for(i in self.users_ids) {
				ids.unshift(i);
			}
			return ids;
		};

		self.pingUser = function(user_id) {
			if ( self.users_ids[user_id] == undefined ) {
				return false;
			}
			self.users_ids[user_id] = Math.round(+new Date()/1000);
			return true;
		}

		self.addUser = function(user) {
			if ( self.users_ids[user.user_id] !== undefined ) {
				return false;
			}
			
			/** Creates last ping **/
			self.users_ids[user.user_id] = Math.round(+new Date()/1000);
			
			if ( typeof window  === 'undefined' ) {
				var type = '';
				if (user.type == 'TWITTER') {
					type= '@' + user.username;
				} else {
					type= 'Anonymous';
				}
				var join_message = 'User ' + user.username +' ('+type+') entered the room.';
				
				self.addSystemMessage(join_message); 
				var data = {action: 'update_users'};
				client.publish('/server_actions_' + self._id, data);
			}

			return true;
		};

		self.addMessage = function(data) {
			var message = {
				_id: data._id,
				room_id: self._id,
				text: data.text,
				user: data.user,
				user_id: data.user_id,
				bookmarks: [],
				replies: []
			}
			
			self.messages.push(message);
			
			self.renderMessage(message);
			if (view_config.notifications == true) { // Notifications active
				var text = (message.text >30)? message.text.substring(0,20) + '...': message.text;
				var notification = window.webkitNotifications.createNotification(
					'/img/favicon.png', self.name, message.user.username +": " + text);
				notification.ondisplay = function() {
					setTimeout(function() {
						notification.cancel();
					}, 5000);
				};
				notification.show();
			}			
		};

		/**
		* @return TRUE in case now he loves it, False in case he doesn't like it undefined
		*		  if the message doesn't exist.
		*/
		/*self.toogleBookmark = function(user_id, message_id) {
			var loves = self.userLoveMessage(user_id, message_id)
			var index = self.getMessageIndex(message_id);
			if( loves === false) {
				if(index !== false) {
					//Adds it to the loves array
					self.messages[index].loves.push(user_id);
					return true
				}
			} else if (loves === true) {
				for (var i = 0; i < self.messages[index].loves.length; i++) {
					// Removes it from the loves array
					if ( self.messages[index].loves[i] == user_id ) {
						self.messages[index].loves.splice(i,1);
						return false;
					}
				}
			}
			return undefined;
		}*/


		self.getMessageIndex = function(message_id) {
			for (var i = 0; i < self.messages.length; i++) {
				if(self.messages[i]._id==message_id) {
					return i;
				}
			}
			return false;
		}

		self.getUserIndex = function(user_id) {
			for (var i = 0; i < self.users.length; i++) {
				if(self.users[i]._id==user_id) {
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

		self.replyMessage = function(message_id, user_id, text) {
			var index = self.getMessageIndex(message_id);
			var timestamp = Math.round(+new Date()/1000);
			
			if (index !== false) {
				var user = osomtalk.getUser(user_id);
				var reply = {
					id: timestamp + "-" + user_id,
					timestamp: timestamp,
					user:{
						user_id: user_id,
						username: user.username,
						type: user.type
					} ,
					text: text
				}
				self.messages[index].replies.push(reply);
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

		self.getMessage = function(message_id) {
			var index = self.getMessageIndex(message_id);
			if (index !== false) {
				return self.messages[index];
			}
			return false;
		}

		self.userLoveMessage = function(user_id, message_id) {
			var index = self.getMessageIndex(message_id);
			if (index !== false ) {
				for (var i = 0; i < self.messages[index].loves.length; i++) {
					if(self.messages[index].loves[i]==user_id) {
						return true;
					}
				}
				return false;
			}
		}

		self.addSystemMessage = function(text) {
			var timestamp = Math.round(+new Date()/1000);
			message = {
				id: timestamp + "OSOM",
				time: timestamp,
				text: text,
				user: {username: 'OsomTalk Bot', type: 'SYSTEM'},
				user_id: 'OSOM'
			};
			self.addMessage(message);
		};
	
		self.renderMessage = function (message) {
			var previewsHTML = utils.getPreviewsHTML(message.text, message._id);
			var escapedName = 'test';//message.user.username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
			var date = new Date(message.time * 1000);
			var date = utils.getLocaleShortDateString(date) + " " + date.toLocaleTimeString();
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

			//if(message.user.type=='USER') {
			if (true) {
				string = '<div class="message" id="'+message._id+'"><div class="info"><span class="user">' + escapedName + '</span> <span class="muted">(Anonymous)</span><div class="time">' + date + '</div></div><div class="utility">' + toggle_preview_button + delete_button + reply_button + '</div><div class="text">' + utils.markdown(message.text) +'</div>';
			} else if(message.user.type=='TWITTER') {
				string = '<div class="message" id="'+message._id+'"><div class="info"><span class="user">' + escapedName + '</span> <a class="muted" target="_BLANK" href="http://twitter.com/'+message.user.username+'">(@'+message.user.username+')</a><div class="time">' + date + '</div></div><div class="utility">' + toggle_preview_button + delete_button + reply_button + '</div><div class="text">' + utils.markdown(message.text) +"</div>";	
			} else if(message.user.type=='OFFICIAL') {
				string = '<div class="message" id="'+message._id+'"><div class="info"><span class="user">' + escapedName + '</span> <span class="muted">(Official)</span><div class="time">' + date + '</div></div><div class="utility">' + toggle_preview_button + '</div><div class="text">' + utils.markdown(message.text) +'</div>';
			} else if(message.user.type=='SYSTEM') {
				var escapedText = message.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
				string = '<div class="message system" id="'+message._id+'"><span class="time">' + date + ':</span> ' + escapedText +'</div>';
			} else {
				string = '<div class="message" id="'+message._id+'"><div class="info"><span class="user">' + escapedName + '</span> <span class="muted">(Anonymous)</span><div class="time">' + date + '</div></div><div class="utility">' + toggle_preview_button + delete_button + reply_button + '</div><div class="text">' + utils.markdown(message.text) +'</div>';
			}
			//if ( message.user.type!='SYSTEM') {
			if (true) {
				if(previewsHTML !== '') {
					string += '<div class="preview_container">';
				}
				if(view_config.previews) {
					string += previewsHTML;
				} 
				if(previewsHTML !== '') {
					string += '</div>';
				}
				/*string += '<div class="replies">';
				if(message.replies.length > 0 ) {
					string += self.renderReplies(message.replies);
				}*/
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
				var user_text = replies[i].user.username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
				user_text = (replies[i].user.type==="TWITTER")? "@"+user_text: user_text + '<span class="muted">(Anonymous)</span>';
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
		
		/** renders the chat **/
		self.renderRoom = function() {
			self.renderMessages();
		};

		self.renderMessages = function() {
			/** Render Messages **/
			for(var i = 0; i < self.messages.length; i++) {
				self.renderMessage(self.messages[i]);
			}
		}

		self.renderUsers = function() {
			/** Render Users **/
			$('#users').html('');
			for(var i = 0; i < self.users.length; i++) {
				self.renderUser(self.users[i]);
			}
		}
		
		/** Connections with web services **/
		/** Gets full room data **/
		self.getRoomData = function(callback){
			$.ajax({
				url: '/rooms/get/'+ self._id,
				success: function(data) {
					self.name = data.name;
					self.users = data.users;
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
					self.users = data;
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