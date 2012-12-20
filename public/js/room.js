(function (global){

	var Room = function(config) {
		config = config || {};
		var self = {};

		self.id			= config.id;
		self.name		= config.name || '';
		self.users  	= config.users || [];
		self.users_ids 	= config.users_ids || [];
		self.messages 	= config.messages || [];

		self.getRoom = function () {
			return {
				id:self.id,
				name:self.name,
				messages:self.messages,
				users: osomtalk.getUsersFromRoom(self.id)
			}
		};

		self.getMessages = function () {
			return self.messages;
		};

		self.setMessages = function(messages) {
			self.messages = messages;
		}

		self.userExists = function(identifier) {
			return (self.users_ids[identifier]!==undefined);
		}

		self.getUsersIds = function () {
			var ids = []
			for(i in self.users_ids) {
				ids.unshift(i);
			}
			return ids;
		};

		self.pingUser = function(identifier) {
			if ( self.users_ids[identifier] == undefined ) {
				return false;
			}
			self.users_ids[identifier] = Math.round(+new Date()/1000);
			return true;
		}

		self.addUser = function(user) {
			if ( self.users_ids[user.identifier] !== undefined ) {
				return false;
			}
			
			/** Creates last ping **/
			self.users_ids[user.identifier] = Math.round(+new Date()/1000);
			
			if ( typeof window  === 'undefined' ) {
				var type = '';
				if (user.type == 'TWITTER') {
					type= '@' + user.identifier;
				} else {
					type= 'Anonymous';
				}
				var join_message = 'User ' + user.username +' ('+type+') entered the room.';
				
				self.addSystemMessage(join_message); 
				var data = {action: 'update_users'};
				client.publish('/server_actions_' + self.id, data);
			}

			return true;
		};

		self.addMessage = function(data) {
			var message = {
				id: data.id,
				time: data.time,
				text: data.text,
				user: data.user,
				identifier: data.identifier,
				loves: []
			}
			self.messages.push(message);
			if ( typeof window  !== 'undefined' ) {
				self.renderMessage(message);
				if (window.webkitNotifications.checkPermission() == 0) { // 0 is PERMISSION_ALLOWED
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
			} else {
				client.publish('/server_messages_' + self.id, message);
				if ( self.messages.length > 100 ) {
					//Maximum of 100 messages in memory for each chat on the server chat
					console.log('deleting extra message', self.messages.shift());
				}
			}
		};

		/**
		* @return TRUE in case now he loves it, False in case he doesn't like it undefined
		*		  if the message doesn't exist.
		*/
		self.toogleMessageLove = function(identifier, message_id) {
			var loves = self.userLoveMessage(identifier, message_id)
			var index = self.getMessageIndex(message_id);
			if( loves === false) {
				if(index !== false) {
					//Adds it to the loves array
					self.messages[index].loves.push(identifier);
					return true
				}
			} else if (loves === true) {
				for (var i = 0; i < self.messages[index].loves.length; i++) {
    				// Removes it from the loves array
    				if ( self.messages[index].loves[i] == identifier ) {
    					self.messages[index].loves.splice(i,1);
    					return false;
    				}
				}
			}
			return undefined;
		}


		self.getMessageIndex = function(message_id) {
			for (var i = 0; i < self.messages.length; i++) {
    			if(self.messages[i].id==message_id) {
    				return i;
    			}
			}
			return false;
		}

		self.getMessage = function(message_id) {
			var index = self.getMessageIndex(message_id);
			if (index !== false) {
				return self.messages[index];
			}
			return false;
		}

		self.userLoveMessage = function(identifier, message_id) {
			var index = self.getMessageIndex(message_id);
			if (index !== false ) {
				for (var i = 0; i < self.messages[index].loves.length; i++) {
	    			if(self.messages[index].loves[i]==identifier) {
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
				identifier: 'OSOM'
			};
			self.addMessage(message);
		};
	
		self.renderMessage = function (message) {
			var previewsHTML = utils.getPreviewsHTML(message.text, message.id);
			
			var escapedName = message.user.username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
			
			var date = new Date(message.time * 1000);
			
			var date = utils.getLocaleShortDateString(date) + " " + date.toLocaleTimeString();
			
			var string = '';
			
			if(message.user.type=='TWITTER') {
				string = '<div class="message" id="'+message.id+'"><div class="info"><span class="user">' + escapedName + '</span> <a class="muted" target="_BLANK" href="http://twitter.com/'+message.user.username+'">(@'+message.user.username+')</a><div class="time">' + date + '</div></div><div class="utility"><a class="loves btn btn-primary btn-mini" onclick="clickedLove(this)"><i class="icon-heart icon-white"></i> <span class="counter">' + message.loves.length + '</span></a></div><div class="text">' + utils.markdown(message.text) +"</div>";	
			} else if(message.user.type=='OFFICIAL') {
				string = '<div class="message" id="'+message.id+'"><div class="info"><span class="user">' + escapedName + '</span> <span class="muted">(Official)</span><div class="time">' + date + '</div></div><div class="utility"><a class="loves btn btn-primary btn-mini" onclick="clickedLove(this)"><i class="icon-heart icon-white"></i> <span class="counter">' + message.loves.length + '</span></a></div><div class="text">' + utils.markdown(message.text) +'</div>';
			} else if(message.user.type=='SYSTEM') {
				var escapedText = message.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
				string = '<div class="message system" id="'+message.id+'"><span class="time">' + date + ':</span> ' + escapedText +'</div>';
			} else {
				string = '<div class="message" id="'+message.id+'"><div class="info"><span class="user">' + escapedName + '</span> <span class="muted">(Anonymous)</span><div class="time">' + date + '</div></div><div class="utility"><a class="loves btn btn-primary btn-mini" onclick="clickedLove(this)"><i class="icon-heart icon-white"></i> <span class="counter">' + message.loves.length + '</span></a></div><div class="text">' + utils.markdown(message.text) +'</div>';
			}
			if ( message.user.type!='SYSTEM') {
				$('#messages').prepend(string + previewsHTML+'</div>');
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
			$('#users').prepend('<div class="user" id="user_' + user.identifier + '">' + escapedName + type + '</div>');
		}
		
		/** renders the chat **/
		self.renderRoom = function() {
			self.renderMessages();
			self.renderUsers();
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
				url: '/rooms/get/'+ self.id,
				success: function(data) {
					self.name = data.name;
					self.users = data.users;
					self.messages = data.messages;
					callback();
				}
			});
		};

		self.getUsersData = function(callback){
			$.ajax({
				url: '/rooms/get_users/'+ self.id,
				success: function(data) {
					self.users = data;
					callback();
				}
			});
		};

		self.subscribe = function(client) {
			client.subscribe('/server_messages_'+ self.id, function(message) {
				self.addMessage(message);
			});
			client.subscribe('/server_actions_'+ self.id, function(data) {
				if(data.action=='update_users') {
					self.getUsersData(self.renderUsers);
				}
				if(data.action=='update_loves') {
					escaped_message_id = data.message.id.replace(/([ #;&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');
					$("div[id=" + escaped_message_id + "] .loves .counter").html(data.message.loves.length);
				}
			});
		}

		self.cleanUsers = function() {
			var timestamp = Math.round(+new Date()/1000);
			//console.log("Checking timeout " + self.id);
			for( i in self.users_ids ) {
				if( (timestamp - self.users_ids[i]) >120) { // Seconds
					delete self.users_ids[i];
					
					if ( typeof window  === 'undefined' ) {
						user = osomtalk.getUser(i);
						var type = '';
						if (user.type == 'TWITTER') {
							type= '@' + user.identifier;
						} else {
							type= 'Anonymous';
						}
						var leave_message = 'User ' + user.username +' ('+type+') left the room.';
						self.addSystemMessage(leave_message);
						
						var data = {action: 'update_users'};
						client.publish('/server_actions_' + self.id, data);
					}
				}
			}

			setTimeout(function(){self.cleanUsers()}, 120*1000);//Milliseconds
		}
		
		/** Starts the user cleaning iterative process **/
		self.cleanUsers();
		return self;
	};

	global.Room = Room;
}(typeof window  === 'undefined' ? exports : window));