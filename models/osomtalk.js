(function (global){

	var OsomTalk = function(config){
		config = config || {};
		var self = {};

		self.url			= frontEndConfig.url;
		self.port			= appConfig.port || 80;
		self.rooms			= config.rooms || [];
		self.users 			= config.users || [];
		self.spam_filter	= [];
		
		self.oa = new OAuth (
			"https://api.twitter.com/oauth/request_token",
			"https://api.twitter.com/oauth/access_token",
			appConfig.consumer_key, appConfig.consumer_secret,
			"1.0", self.url + "/auth/twitter/callback",
			"HMAC-SHA1"
		);
		
		/** Generates an unused room id  and then store the room in it **/
		self.addRoom = function(room){
			if(room.room_id == undefined) {
				do {
					room_id = utils.makeId(7);    
				} while (self.roomExists(room_id) );
			} else {
				room_id = room.room_id;
				if(self.roomExists(room_id)){
					console.log ('Room id already taken: ' + room_id);
					return false;
				}
			}
			
			room = new Room({id:room_id, name:room.name, type:'PUBLIC'});
			return self.rooms[room_id] = room;
		}

		self.addUserToRoom = function(identifier, room_id){
			if (!self.roomExists(room_id)) {
				return false;
			}
			if (!self.userExists(identifier)) {
				return false;
			}
			return self.rooms[room_id].addUser(self.users[identifier]);
		}

		self.toogleLove = function(identifier, room_id, message_id){
			if (!self.roomExists(room_id)) {
				return false;
			}
			if (!self.userExists(identifier)) {
				return false;
			}
			var love = self.rooms[room_id].toogleMessageLove(identifier, message_id);
			if (love !== undefined) {
				var data = {
					action: 'update_loves',
					message: self.rooms[room_id].getMessage(message_id)
				};
				client.publish('/server_actions_' + room_id, data);
			}
			return love
		}

		self.deleteMessage = function(room_id, message_id){
			if (!self.roomExists(room_id)) {
				return false;
			}
			var deleted = self.rooms[room_id].deleteMessage(message_id);
			if (deleted !== undefined) {
				var data = {
					action: 'delete_message',
					message_id: message_id
				};
				client.publish('/server_actions_' + room_id, data);
			}
			return deleted
		}

		self.replyMessage = function(room_id, message_id, identifier, text){
			if (!self.roomExists(room_id)) {
				return false;
			}
			var replied = self.rooms[room_id].replyMessage(message_id, identifier, text);
			
			if (replied !== undefined) {
				var index = self.rooms[room_id].getMessageIndex(message_id);
				var data = {
					action: 'update_message_replies',
					message_id: message_id,
					replies: self.rooms[room_id].messages[index].replies
				};
				client.publish('/server_actions_' + room_id, data);
			}
			return replied;
		}

		self.getRoom = function(room_id) {
			if (!self.roomExists(room_id)) {
				return false;
			}
			return self.rooms[room_id];
		}

		self.getUsersFromRoom = function(room_id) {
			if (!self.roomExists(room_id)) {
				return false;
			}
			var users=[];
			var users_ids = self.rooms[room_id].getUsersIds();
			for (var i=0;i<users_ids.length;i++) {
				if( typeof self.users[users_ids[i]] !== 'undefined') {
					aux = {
						username: self.users[users_ids[i]].username,
						type: self.users[users_ids[i]].type,
						identifier: self.users[users_ids[i]].identifier,
					}
					users.push(aux)
				} else {
					self.rooms[room_id].users_ids.splice(i,1);
				}
			}
			return users;
		}

		/** 
		 *  Finds out if the user already exists
		 *  overwrites anonymous users with twitter ones
		 *  @todo think about a better bussiness logic to allow FB login
		 **/
		self.addUser = function(user) {
			var identifier  = utils.makeId(7)
			  , uniquer	= utils.createIdentifier(user.username);

			for (var i in self.users) {
				if(self.users[i].uniquer==uniquer) {
	    			if (user.type!=="TWITTER") {
						return false;
					} else if (user.type === self.users[i].type) {
						return self.users[i];
					} else {
						delete self.users[i];
						break;
					}
    			}
			}
			user.username = user.username.trim();
			user.identifier= identifier;
			user = new User(user);
			self.users[identifier] = user;
			return user;
		}
		
		
		self.verifyPermission = function(identifier, token, room_id) {
			if ( !self.userExists(identifier) ) {
				//console.log("User doesn't exists: " + identifier);
				return false;
			}
			if (self.users[identifier].token !== token) {
				//console.log("Wrong Token: " + token);
				return false;
			}
			
			if(room_id !== undefined) {
				if ( !self.roomExists(room_id) ) {
					//console.log("Room doesn't exists");
					return false;
				}
				if (!self.rooms[room_id].userExists(identifier)){
					//console.log("User doesn't belong to room");
					return false;
				}
			}
			return true;
		}
		
		self.roomExists = function (room_id) {
			if(room_id==undefined) {
				console.log("passing undefined to roomExists");
			}
			return (self.rooms[room_id]!==undefined);
		}
		
		self.userExists = function(identifier) {
			if(identifier==undefined) {
				console.log("passing undefined to userExists");
			}
			return (self.users[identifier]!==undefined);	
		}

		self.getUser = function(identifier) {
			/**	Cleanse the name up to a identifier status **/
			if ( !self.userExists(identifier) ) {
				return false;
			}
			return self.users[identifier];
		}

		self.validateMessage = function(text) {
			var trimmed_text = utils.trim(text);
			if (text.length>1024) {
				return {error:'BLOCKED_LARGE'};
			} else if (trimmed_text.length==0) {
				return {error:'BLOCKED_EMPTY'};
			}
			return true;
		}

		self.pingUser = function(room_id, identifier) {
			if (!self.roomExists(room_id)) {
				return false;
			}
			if (!self.userExists(identifier)) {
				return false;
			}
			//console.log(identifier + " pingin " + room_id);
			self.rooms[room_id].pingUser(identifier);
			self.users[identifier].ping();
		}

		self.validateSpam = function (identifier) {
			var current_time = Math.round(+new Date()/1000);
			var block='';
			if ( self.spam_filter[identifier] === undefined ) {
				self.spam_filter[identifier] = {
					last: 0,
					times: []
				};
			} else if ( (current_time - self.spam_filter[identifier].last) <= 2 ){
				/** checks for fast typing**/
				console.log('Blocking ' + identifier + ' for Fast Typing');
				block = 'BLOCKED_TYPING';
			} else {
				/** Checks for more than 15 messages in less than a minute **/
				/*var i_time = 0;
				do {
					i_time = self.spam_filter[identifier].times.shift();
				} while( (current_time - i_time) > 60 );
				self.spam_filter[identifier].times.unshift(i_time);				
				if ( self.spam_filter[identifier].times.length > 15) {
					console.log('Blocking ' + identifier + ' for Flooding');
					block = 'BLOCKED_FLOODING';
				}*/
			}
			self.spam_filter[identifier].last = current_time;
			self.spam_filter[identifier].times.push(current_time);
			if(block !='') {
				return {error:block};
			}
			return true;
		}

		self.validateUserName = function (username) {
			username = username.trim();
			
			/**Check For Empty**/
			if (username=='') {
				return {error: 'EMPTY'};
			}
			/** Check For Impersonator **/
			if (username.toLowerCase()=="osomtalk bot" || username.toLowerCase()=="osomtalk" || username.toLowerCase()=="osom talk" ) {
				return {error: 'CHEATER'};
			}
			
			/**Check For Too Long**/
			if (username.length > 20) {
				return {error: 'TOO_LONG'};
			}
			return true;
		}

		self.cleanUsers = function() {
			var timestamp = Math.round(+new Date()/1000);
			for( i in self.users) {
				if( (timestamp - self.users[i].lastPing) >  1800) {//Seconds
					//console.log(i + " Timed out totally");
					delete self.users[i];
				}
			}
			setTimeout(function(){self.cleanUsers()}, 1800*1000);//Milliseconds
		}

		/** Starts the user cleaning iterative process **/
		self.cleanUsers();
	
	return self;
};

global.OsomTalk = OsomTalk;
}(typeof window  === 'undefined' ? exports : window));