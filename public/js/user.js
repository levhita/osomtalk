(function (global){

	var User = function(config){
		config = config || {};
		var self = {};

		self._id 		= config._id || '';
		self.uniquer	= utils.createUniquer(config.username);
		self.username	= config.username || '';
		self.type 		= config.type || "ANONYMOUS";
		self.token		= config.token || '';
		self.lastPing	= Math.round(+new Date()/1000);
		self.access_token    =  config.oauth_access_token || '';
		self.access_token_secret = config.oauth_access_token_secret || '';
		
		var hmac = crypto.createHmac('sha256', utils.makeId(20));
		self.token  = hmac.update(self.username).digest('hex');

		self.ping = function() {
			self.lastPing = Math.round(+new Date()/1000);
		}

		self.getData = function () {
			return {
				_id: self._id,
				uniquer: self.uniquer,
				username: self.username,
				type: self.type, 	
				token: self.token,	
				lastPing: self.lastPing,
				access_token: self.access_token,
				access_token_secret: self.access_token_secret
			};
		}

		return self;		
	};

global.User = User;
}(typeof window  === 'undefined' ? exports : window));