(function (global){

	var OsomTalk = function(config){
		config = config || {};
		var self = {};

		self.url			= config.url;
		self.port			= config.port || 80;
		self.rooms			= config.rooms || [];
		self.users 			= config.users || [];
		self.spam_filter	= [];
		
		self.oa = new OAuth (
			"https://api.twitter.com/oauth/request_token",
			"https://api.twitter.com/oauth/access_token",
			self.consumer_key, self.consumer_secret,
			"1.0", self.url + "/auth/twitter/callback",
			"HMAC-SHA1"
		);
		
		/** Generates an unused room id  and then store the room in it **/
		self.addRoom = function(room){
			do {
				room_id = utils.makeId(7);    
			} while (self.rooms[room_id] !== undefined);

			room = new Room({id:room_id, name:req.body.name, type:'PUBLIC'});
			return self.rooms[room_id] = room;
		}

		self.getRoom = function(room_id) {
			if (self.rooms[room_id]===undefined) {
				return false;
			}
			return self.rooms[room_id].getRoom();
		}

		/** 
		 *  Finds out if the user already exists
		 *  overwrites anonymous users with twitter ones
		 *  @todo think about a better bussiness logic to allow FB login
		 **/
		self.addUser = function(user) {
			if ( self.users[identifier]!==undefined && user.type!=="TWITTER") {
				return false;
			}
			return self.users[identifier] = user;
		}

		self.validateMessage = function(text) {
			if (text.length>1024) {
				return {error:'BLOCKED_LARGE'};
			} else if (text.length==0) {
				return {error:'BLOCKED_EMPTY'};
			}
			return true;
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
				var i_time = 0;
				do {
					i_time = self.spam_filter[identifier].times.shift();
				} while( (current_time - i_time) > 60 );
				self.spam_filter[identifier].times.unshift(i_time);				
				if ( self.spam_filter[identifier].times.length > 15) {
					console.log('Blocking ' + identifier + ' for Flooding');
					block = 'BLOCKED_FLOODING';
				}
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

			/**Check For Too Long**/
			if (username.length > 20) {
				return {error: 'TOO_LONG'};
			}
			return true;
		}

	return self;
};

global.OsomTalk = OsomTalk;
}(typeof window  === 'undefined' ? exports : window));