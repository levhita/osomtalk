(function (global){

	var OsomTalk = function(config){
		config = config || {};
		var self = {};

		self.url            = frontEndConfig.url;
		self.port           = appConfig.port || 80;
		self.rooms          = config.rooms || [];
		self.users          = config.users || [];
		self.spam_filter    = [];
		
		MongoClient.connect(appConfig.osomtalk_chat,
			function(err, db) {
				if(!err) {
					self.db = db;
					
					db.createCollection('rooms', function(err, collection){
						self.rooms = collection;
					});
					
					db.createCollection('users', function(err, collection){
						self.users = collection;
					});
					
					db.createCollection('messages', function(err, collection){
						self.messages = collection;
						collection.ensureIndex("room_id",function(){});
					});

					self.ObjectID = self.db.bson_serializer.ObjectID;
				} else {
					console.log(err);
					process.exit(1);
				}
			});

		self.oa = new OAuth (
			"https://api.twitter.com/oauth/request_token",
			"https://api.twitter.com/oauth/access_token",
			appConfig.consumer_key, appConfig.consumer_secret,
			"1.0", self.url + "/auth/twitter/callback",
			"HMAC-SHA1"
			);
		
		/** @todo: ¿Have the rooms in redis to check for existence faster maybe? **/
		self.addMessageToRoom = function(room_id, data) {
			self.rooms.findOne({_id: osomtalk.ObjectID(room_id)}, function(err, room_data){
				if(!err && room_data != null) {
					var message = {
						_id:        self.ObjectID(),
						room_id:    room_id,
						text:       data.text,
						user_id:    data.user_id,
						type:       data.type,
						bookmarks:  [],
						replies:    []
					}
					self.messages.insert(message, {w:0});
					client.publish('/server_messages_' + room_data._id,  message);
				}   
			});
		}

		self.addUserToRoom = function(user_id, room_id, callback){
			self.rooms.findOne({room_id: room_id}, function(err, room_data) {
				var room = new Room(room_data);
				
				if ( !room.userExists(user_id) ) {

					osomtalk.users.findOne({_id: self.ObjectID(user_id)}, function(err, user_data){
						//Inserts user into room
						self.rooms.update({room_id: room_id},
							{$push:
								{users: {user_id: user_id, last_ping: utils.getTimestamp()}
							}}, {w:0});

//						revisar que se inserte el usuario completo en db,
//revisar que se guarde en session

						var type = '';
						if (user_data.type == 'TWITTER') {
							type= '@' + user_data.username;
						} else {
							type= 'Anonymous';
						}
						var join_message = 'User ' + user_data.username +' ('+type+') entered the room.';

						self.addSystemMessage(join_message); 
						
						var data = {action: 'update_users'};
						client.publish('/server_actions_' + room_id, data);
					});
					
					
					return true;
				};
			});
		}

		self.addRoom = function(room){
			var room = new Room({
				_id: new self.ObjectID(),
				name:room.name,
				type:'PUBLIC'
			});
			self.rooms.insert(room.getData(), {w:1}, function(err, results){});
			return room._id.toHexString();
		}

		self.deleteMessage = function(room_id, message_id) {
			self.rooms.findOne({room_id: self.ObjectID(room_id)}, function(err, room_data) {
				self.messages.remove({_id: self.ObjectID(message_id)},{w:1}, function(err, result) {
					if(!err) {
						var data = {
							action: 'delete_message',
							message_id: message_id
						};
						client.publish('/server_actions_' + room_id, data);
					}
				});
			});
		}

		self.replyMessage = function(room_id, message_id, user_id, text){
			if (!self.roomExists(room_id)) {
				return false;
			}
			var replied = self.rooms[room_id].replyMessage(message_id, user_id, text);

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

		self.getRoom = function(room_id, callback) {
			if(room_id.length != 24) {
				callback(false);
			} else {
				osomtalk.rooms.findOne({_id: osomtalk.ObjectID(room_id)},
					function(err, results) {
						var room = new Room(results);
						callback(room);
					}); 
			}
		}

		self.getMessages = function(room_id, callback) {
			var data = [];
			self.messages.find({room_id: room_id},
				function(err, messages) {
					messages.each(function(err, message) {
						if(message !== null){
							data.push(message)
						} else {
							callback(data);
						}
					});
				});
		};

		self.getUsersFromRoom = function(room_id, callback) {
			if(room_id.length != 24) {
				callback(false);
			} else {
				osomtalk.rooms.findOne({_id: osomtalk.ObjectID(room_id)},
					function(err, results) {
						var room = new Room(results);
						callback(room);
					}); 
			}

			var data = [];
			self.messages.find({room_id: room_id},
				function(err, messages) {
					messages.each(function(err, message) {
						if(message !== null){
							data.push(message)
						} else {
							callback(data);
						}
					});
				});

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
						user_id: self.users[users_ids[i]].user_id,
					}
					users.push(aux)
				} else {
					self.rooms[room_id].users_ids.splice(i,1);
				}
			}
			return users;
		}

		self.addUser = function(user, callback) {
			var uniquer = utils.createUniquer(user.username);

			self.users.findOne({uniquer: uniquer}, function(err, user_data){
				if(!err) {
					if( user != null) {
						if (user.type !== ' TWITTER') {
							callback(false);
							return;
						} else if (user.type === user_data.type ) {
							callback(user);
							return;
						}
						self.users.remove({_id: user_data._id}, {w:0});
					}
					user.username = user.username.trim();
					user = new User(user);
					self.users.insert(user.getData());
					callback(user);
				}
			});
		}

		/** mongodebear **/
		self.verifyPermission = function(user_id, token, room_id, callback) {
			/*if ( !self.userExists(user_id) ) {
				//console.log("User doesn't exists: " + user_id);
				callback(false);
			}
			if (self.users[user_id].token !== token) {
				//console.log("Wrong Token: " + token);
				callback(false);
			}*/
			
			/*if(room_id !== undefined) {
				if ( !self.roomExists(room_id) ) {
					//console.log("Room doesn't exists");
					return false;
				}
				if (!self.rooms[room_id].userExists(user_id)){
					//console.log("User doesn't belong to room");
					return false;
				}
			}*/
			callback(true);
		}
		
		/** mongodebear **/
		self.getUser = function(user_id) {
			/** Cleanse the name up to a user_id status **/
			if ( !self.userExists(user_id) ) {
				return false;
			}
			return self.users[user_id];
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
		
		/** mongodebear **/
		self.pingUser = function(room_id, user_id) {
			if (!self.roomExists(room_id)) {
				return false;
			}
			if (!self.userExists(user_id)) {
				return false;
			}
			self.rooms[room_id].pingUser(user_id);
			self.users[user_id].ping();
		}
		/** mongodebear redisear**/
		self.validateSpam = function (user_id) {
			var current_time = Math.round(+new Date()/1000);
			var block='';
			if ( self.spam_filter[user_id] === undefined ) {
				self.spam_filter[user_id] = {
					last: 0,
					times: []
				};
			} else if ( (current_time - self.spam_filter[user_id].last) <= 2 ){
				/** checks for fast typing**/
				console.log('Blocking ' + user_id + ' for Fast Typing');
				block = 'BLOCKED_TYPING';
			} else {
				/** Checks for more than 15 messages in less than a minute **/
				/*var i_time = 0;
				do {
					i_time = self.spam_filter[user_id].times.shift();
				} while( (current_time - i_time) > 60 );
				self.spam_filter[user_id].times.unshift(i_time);                
				if ( self.spam_filter[user_id].times.length > 15) {
					console.log('Blocking ' + user_id + ' for Flooding');
					block = 'BLOCKED_FLOODING';
				}*/
			}
			self.spam_filter[user_id].last = current_time;
			self.spam_filter[user_id].times.push(current_time);
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

		/** mongodebear **/
		self.cleanUsers = function() {
			var timestamp = Math.round(+new Date()/1000);
			for( i in self.users) {
				if( (timestamp - self.users[i].lastPing) >  7200) {//Seconds
					//console.log(i + " Timed out totally");
					delete self.users[i];
				}
			}
			setTimeout(function(){self.cleanUsers()}, 7200*1000);//Milliseconds
		}

		/** Starts the user cleaning iterative process **/
		//self.cleanUsers();

		return self;
	};

	global.OsomTalk = OsomTalk;
}(typeof window  === 'undefined' ? exports : window));