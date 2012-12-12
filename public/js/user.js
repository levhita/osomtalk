(function (global){

	var User = function(config){
		config = config || {};
		var self = {};

		self.username	= config.username || '';
		self.type 		= config.type || "ANONYMOUS";
		self.token		= config.token || '';
		self.identifier = config.identifier || '';
		self.lastPing	= Math.round(+new Date()/1000);
		
		var hmac = crypto.createHmac('sha256', utils.makeId(20));
		self.token  = hmac.update(self.username).digest('hex');

		self.ping = function() {
			self.lastPing = Math.round(+new Date()/1000);
		}

		return self;		
	};

global.User = User;
}(typeof window  === 'undefined' ? exports : window));