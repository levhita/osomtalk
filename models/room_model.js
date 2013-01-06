(function (global){

	var Room = function(config) {
		config = config || {};
		var self = {};

		self._id			= config._id;
		self.name		= config.name || '';
		self.type 		= config.type || 'PUBLIC';
		self.admins		= config.admins || [];
		self.users  	= config.users || [];
		
		/** This one should be the one **/
		self.getData = function () {
			return {
				_id: 		self._id,
				name: 		self.name,
				type: 		self.type,
				admins:  	self.admins,
				users:  	self.users
			}
		};

		self.userExists = function(user_id) {
			for(i in self.users) {
				if( self.users[i].user_id == user_id) {
					return true;
				}
			}
			return false;
		}

		self.getUsersIds = function () {
			var ids = []
			for(i in self.users) {
				ids.unshift(self.users[i].user_id);
			}
			return ids;
		};

		/** TODO mongodebear **/
		self.pingUser = function(user_id) {
			if ( self.users_ids[user_id] == undefined ) {
				return false;
			}
			self.users_ids[user_id] = Math.round(+new Date()/1000);
			return true;
		}


		self.addMessage = function(data) {
			var message = {
				_id: data._id,
				room_id: self._id,
				text: data.text,
				user_id: data.user_id,
				bookmarks: [],
				replies: []
			}
			client.publish('/server_messages_' + self._id, message);
		};
		
		/** TODO mongodebear **/
		self.deleteMessage = function(message_id) {
			var index = self.getMessageIndex(message_id);
			if (index !== false) {
				self.messages.splice(index, 1);
				return true;
			}
			return false;
		}

		/** TODO mongodebear **/
		self.replyMessage = function(message_id, user_id, text) {
			var index = self.getMessageIndex(message_id);
			var timestamp = utils.getTimeStamp();
			
			if (index !== false) {
				var reply = {
					id: timestamp + "-" + user_id,
					timestamp: timestamp,
					user_id: user_id,
					text: text
				}
				self.messages[index].replies.push(reply);
				return true;
			}
			return false;
		}

		self.addSystemMessage = function(text) {
			message = {
				text: text,
				type: 'SYSTEM'
			};
			self.addMessage(message);
		};
	
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
							type= '@' + user.username;
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
		//self.cleanUsers();
		return self;
	};

	global.Room = Room;
}(typeof window  === 'undefined' ? exports : window));