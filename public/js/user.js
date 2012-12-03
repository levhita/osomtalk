(function (global){

	var User = function(config){
		config = config || {};
		var self = {};

		self.username	= config.username || '';
		self.type 		= config.type || "ANONYMOUS";
		self.token		= config.token || '';
		self.identifier = config.identifier || '';
		
		var hmac = crypto.createHmac('sha256', 'anyquerykey');
		self.token  = hmac.update(self.username).digest('hex');

		return self;
	};

global.User = User;
}(typeof window  === 'undefined' ? exports : window));