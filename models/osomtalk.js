(function (global){

	var OsomTalk = function(config) {
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
						replies:    []
					}
					self.messages.insert(message, {w:0});
					client.publish('/server_messages_' + room_data._id,  message);
				}   
			});
		}

		self.addSystemMessageToRoom= function(room_id, text) {
			message = {
				text: text,
				type: 'SYSTEM'
			};
			self.addMessageToRoom(room_id, message);
		};

		self.addUserToRoom = function(user_id, room_id, callback){
			self.rooms.findOne({_id: self.ObjectID(room_id)}, function(err, room_data) {
				if(!err && room_data != null) {
					var room = new Room(room_data);
					if ( !room.userExists(user_id) ) {
						osomtalk.users.findOne({_id: self.ObjectID(user_id)}, function(err, user_data){
							if(!err && user_data != null) {
								self.rooms.update({_id: self.ObjectID(room_id)},
									{$push:{users: {user_id: user_id, last_ping: utils.getTimestamp()}}}, {w:0});
								
								var join_message = 'User "';
								if (user_data.type == 'TWITTER') {
									join_message += '@' + user_data.username +'" (Twitter)';
								} else {
									join_message += user_data.username +'" (Anonymous)';
								}
								join_message +=' entered the room.';

								osomtalk.addSystemMessageToRoom(room_id, join_message); 
								
								var data = {action: 'update_users'};
								client.publish('/server_actions_' + room_id, data);
							} else{
								callback(false);
							}
						});
					};
				} else {
					callback(false);
				}
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
			self.messages.remove({_id: self.ObjectID(message_id)},{w:1}, function(err, result) {
				if(!err) {
					var data = {
						action: 'delete_message',
						message_id: message_id
					};
					client.publish('/server_actions_' + room_id, data);
				}
			});
		}

		self.replyMessage = function(room_id, message_id, user_id, text){
			self.messages.findOne({_id: self.ObjectID(message_id)}, function (err, message) {
				if(!err && message != null) {
					var reply = {
						timestamp: utils.getTimestamp(),
						user_id: user_id,
						text: text
					}
					self.messages.update({_id: self.ObjectID(message_id)}, {$push:{replies: reply}}, {w:0});
					
					var replies = message.replies;
					replies.push(reply);
					
					var data = {
						action: 'update_message_replies',
						message_id: message._id,
						replies: replies
					};
					client.publish('/server_actions_' + room_id, data);						
				}
			});
		}

		self.getRoom = function(room_id, callback) {
			if(typeof room_id !='string' || room_id.length != 24) {
				callback(false);
			} else {
				osomtalk.rooms.findOne({_id: osomtalk.ObjectID(room_id)},
					function(err, results) {
						if(!err && results != null) {
							var room = new Room(results);
							callback(room);
						} else {
							callback(false);
						}
					}); 
			}
		}

		self.getUser = function(user_id, callback) {
			if(typeof user_id !='string' || user_id.length != 24) {
				callback(false);
			} else {
				osomtalk.users.findOne({_id: osomtalk.ObjectID(user_id)},
					function(err, results) {
						if(!err && results != null) {
							callback(results);
						} else {
							callback(false);
						}
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
				self.rooms.findOne({_id: self.ObjectID(room_id)}, function(err, room_data) {
					if (!err && room_data != null) {
						var room = new Room(room_data);

						var search = []; 
						for(var i = 0; i < room.users.length; i++) {
							search.push(self.ObjectID(room.users[i].user_id));
						}
			
						var data = [];		
						self.users.find({_id: {$in: search}}, function(err, users){
							users.each(function(err, user) {
								if(user !== null){
									aux = {
										username: user.username,
										type: user.type,
										user_id: user._id,
									}
									data.push(aux);
								} else {
									callback(data);
								}
							});
						});
					} else {
						callback(false);
					}
				});
			}
		}


		self.addUser = function(user, callback) {
			var uniquer = utils.createUniquer(user.username);
			//, limit: 1
			self.users.find({uniquer: uniquer}, {'sort': [['last_ping', 'desc']], limit: 1}).toArray(
				function(err, user_data) {
					if(!err) {
						if( user_data.length > 0) {
							user_data = user_data[0];
							if (user_data.type === 'TWITTER') {
								if ( user.type === user_data.type  ) {
									callback(new User(user_data));
									return;
								} else {
									// You can't take an already twitter name with an anonymous
									callback(false);
									return;
								}
							} else if (user_data.type === 'ANONYMOUS' && user_data.archived === false) {
								if(user.type === 'TWITTER') {
									/** Twitter users overwrites ANONYMOUS user (archive them) **/
									self.users.update({_id: self.ObjectID(user_data._id)}, {$set: {archived:true}}, {w:0});
									/** We just archive the last one and let the process continue to create the new user **/
								} else {
									/** Anonymous user can't overwrite another active anonymous **/
									callback(false);
									return;
								}
							} else {
								/** Anonymous user can overwrite another archived anonymous,
								we let the process continue to create the new user **/
							}
						}
						user.username = user.username.trim();
						user._id = self.ObjectID();
						user = new User(user);
						self.users.insert(user.getData(), {w:0});
						callback(user);
					} else {
						callback(false);
					}
				}
			);
		}

		/** Room can be set to null ar empty string to avoid validation
		of room specific permission **/
		self.verifyPermission = function(user_id, token, room_id, callback) {
			self.getUser(user_id, function(user){
				if(user != false) {
					if(user.token != token) {
						//console.log("Bad token");
						callback(false);
					} else {
						if( typeof room_id == 'string' && room_id.length==24) {
							self.getRoom(room_id, function(room){
								if(room !== false) {
									if (room.userExists(user_id)) {
										callback(true);
									} else {
										//console.log("user doesn't exist in room");
										callback(false);
									}
								} else {
									//console.log('Unexistant room');
									callback(false);
								}
							});
						} else {
							//console.log('Not asked  to verify permissions for room');
							callback(true);
						}
					}
				} else {
					//console.log("couldn't get User");
					callback(false);
				}
			});
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

		self.pingUser = function(room_id, user_id) {
			var timestamp = utils.getTimestamp();
			self.users.update({_id: self.ObjectID(user_id)}, {$set: {last_ping: timestamp}}, {w:0});
			self.rooms.update({_id: self.ObjectID(room_id),'users.user_id' : user_id },
				{$set: {'users.$.last_ping': timestamp}}, {w:0});
		}
		
		/** mongodebear rediseñar**/
		self.validateSpam = function (user_id) {
			var current_time = utils.getTimestamp();
			var block='';
			if ( self.spam_filter[user_id] === undefined ) {
				self.spam_filter[user_id] = {
					last: 0,
					times: []
				};
			} else if ( (current_time - self.spam_filter[user_id].last) <= 2 ){
				/** checks for fast typing**/
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