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
								
								/** Add user to the users array in the room **/
								self.rooms.update({_id: self.ObjectID(room_id)},
									{$push:{users: {
										user_id: user_id,
										last_ping: utils.getTimestamp(),
										archived: false
									}}}, {w:0});
								
								/** Increment user rooms by one **/
								self.users.update({_id: self.ObjectID(user_id)}, {$inc: {rooms: 1}}, {w:0});

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

		self.getMessages = function(room_id, last_id, callback) {
			var data = [];
			var options = {"limit": 20, 'sort': [['_id', 'desc']]};
			var query = {};
			
			if(last_id == null) {
				query = {room_id: room_id};
			} else {
				query = {_id: {$lt: self.ObjectID(last_id)}, room_id: room_id}
			}
			self.messages.find(query, options,
				function(err, messages) {
					messages.each(function(err, message) {
						if(message !== null){
						data.unshift(message)
						} else {
							callback(data);
						}
					});
				}
			);
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
			self.users.find({uniquer: uniquer}, {'sort': [['last_ping', 'desc']], limit: 1}).toArray(
				function(err, user_data) {
					if(!err) {
						if( user_data.length > 0) {
							user_data = user_data[0];
							if (user_data.type === 'TWITTER') {
								if ( user.type === user_data.type  ) {
									user_data.archived = false;
									self.users.update({_id: user_data._id}, {$set:{archived: false}}, {w:0});
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
			self.rooms.update({_id: self.ObjectID(room_id)}, {$set: {last_ping: timestamp}}, {w:0});
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

				


		/** Clean users after 2 Hours IDLE **/
		self.cleanUsers = function() {
			
			var timestamp = utils.getTimestamp()- 7200;// 2Hrs
			
			//console.log("Archiving Twitter Users");
			self.users.update({last_ping: {$lt: timestamp}}, {$set:{archived: true}}, {w:0, multi:1});
			
			//console.log("Deleting Anonymous Users without any room");
			self.users.remove({
				last_ping: {$lt: timestamp},
				archived: true,
				type: 'ANONYMOUS',
				rooms: {$lte: 0}
			}, {w:0});
			
			setTimeout(function(){self.cleanUsers()}, 7200*1000);//Check Every 2 Hours
		}
		
		/** Removes Empty Anonymous Rooms after 24Hrs Empty **/
		self.cleanRooms = function() {
			//console.log("Cleaning Rooms");
			var one_timestamp = utils.getTimestamp()- 86400; // 1 Day
			var two_timestamp = utils.getTimestamp()- 172800; // 2 Days
			self.rooms.find({$or: [
					{last_ping: {$lt: two_timestamp}, type: 'PUBLIC'}, 
					{last_ping: {$lt: one_timestamp}, type: 'ANONYMOUS'}
				]}).toArray(
				function(err, rooms) {
					if(!err) {
						room_ids = [];
						for(var i = 0; i < rooms.length; i++) {
						 	room_ids.push(rooms[i]._id.toHexString());
						 	users_object_ids = [];
						 	users_ids = [];
						 	for(var j = 0; j < rooms[i].users.length; j++) {
						 		users_object_ids.push(self.ObjectID(rooms[i].users[j].user_id));
						 		users_ids.push(rooms[i].users[j].user_id);
						 	}
						 	//console.log("Cleaning Users:");
						 	//console.log(users_ids);
						 	self.users.update({_id: {$in: users_object_ids}}, {$inc: {rooms: -1}}, {w:0});
						}
						//console.log("Cleaning Messages From Rooms:");
						//console.log(room_ids);
						/** Deletes all Messages in every room
						(ANONYMOUS Rooms doesn't suppose to have messages anyway XD)**/
						self.messages.remove({room_id: {$in: room_ids}}, {w:0});
						
						//console.log("Deleting all Rooms older than 24 Hrs");
						/** Delete the room **/
						self.rooms.remove({last_ping: {$lt: two_timestamp}, type: 'PUBLIC'}, {w:0});
						self.rooms.remove({last_ping: {$lt: one_timestamp}, type: 'ANONYMOUS'}, {w:0});
					}
				});
			
			setTimeout(function(){self.cleanRooms()}, 3600*1000);// Check Every Hour
		}
		
		/** Removes Empty Anonymous Rooms after 24Hrs Empty **/
		self.timeOutUsers = function() {
			
			//console.log("TimingOutUsers");
			var timestamp = utils.getTimestamp() - 120; // 2 Minutes
			
			self.rooms.find().each(
				function(err, room_data) {
          			if(!err && room_data != null) {
          				for(var i = 0; i < room_data.users.length; i++) {
							var user = room_data.users[i];
							if (user.last_ping < timestamp && user.archived == false) {
								/** Updates **/
								self.rooms.update({_id: room_data._id, 'users.user_id' : user.user_id },
									{$set: {'users.$.archived': true}}, {w:0});
								
								/** Send the message **/
								self.getUser(user.user_id, function (user) {
									if (user) {
						 				var leave_message = 'User "';
										if (user.type == 'TWITTER') {
											leave_message += '@' + user.username +'" (Twitter)' ;
										} else {
											leave_message += user.username +'" (Anonymous)' ;
										}
										leave_message += ' left the room.';
										self.addSystemMessageToRoom(room_data._id.toHexString(), leave_message);
									}
						 		});
						 	}
						}
						/** Launch the order to update users on the browser **/
						var data = {action: 'update_users'};
						client.publish('/server_actions_' + room_data._id, data);	
					}
        		}
        	);
			setTimeout(function(){self.timeOutUsers()}, 120*1000);// Check Every 2 Minutes
		}

		/** Starts the cleaning iterative process **/
		// Wait a minute before trying to access the DB
		setTimeout( function(){
			self.cleanUsers();
			self.cleanRooms();
			self.timeOutUsers();
		}, 60 * 1000);// 60 Seconds

		return self;
	};

	global.OsomTalk = OsomTalk;
}(typeof window  === 'undefined' ? exports : window));