(function (global){

	var User = function(config){
		config = config || {};
		var self = {};

		self._id 		= config._id || '';
		self.uniquer	= utils.createUniquer(config.username);
		self.username	= config.username || '';
		self.type 		= config.type || 'ANONYMOUS';
		self.token 		= config.token || '';
		self.archived	= false;
		self.rooms 		= 0;
		self.last_ping	= utils.getTimestamp();
		
		if(config.twitter_id) {
			self.twitter_id = config.twitter_id;
			self.access_token    =  config.access_token;
			self.access_token_secret = config.access_token_secret;
		}
		
		if(!self.token) {
			var hmac = crypto.createHmac('sha256', utils.makeId(20));
			self.token  = hmac.update(self.username).digest('hex');
		}

		self.ping = function() {
			self.last_ping = utils.getTimestamp();
		}

		self.getData = function () {
			var data = {
				_id: self._id,
				uniquer: self.uniquer,
				username: self.username,
				type: self.type,	
				token: self.token,
				archived: self.archived,
				rooms: self.rooms,
				last_ping: self.last_ping
			};
		
			if(self.twitter_id) {
				data.twitter_id = self.twitter_id;
				data.access_token = self.access_token;
				data.access_token_secret = self.access_token_secret;
			}

			return data;
		}

		return self;		
	};

global.User = User;
}(typeof window  === 'undefined' ? exports : window));