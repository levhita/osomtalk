(function (global){

	var Room = function(config) {
		config = config || {};
		var self = {};

		self._id			= config._id;
		self.name		= config.name || '';
		self.type 		= config.type || 'PUBLIC';
		self.admins		= config.admins || [];
		self.users  	= config.users || [];
		self.last_ping	= utils.getTimestamp();
		
		/** This one should be the one **/
		self.getData = function () {
			return {
				_id: 		self._id,
				name: 		self.name,
				type: 		self.type,
				admins:  	self.admins,
				users:  	self.users,
				last_ping:  self.last_ping
			}
		};

		self.userExists = function(user_id) {
			for(var i = 0; i < self.users.length; i++) {
				if( self.users[i].user_id == user_id) {
					return true;
				}
			}
			return false;
		}

		self.userIsArchived = function(user_id) {
			for(var i = 0; i < self.users.length; i++) {
				if( self.users[i].user_id == user_id) {
					return self.users[i].archived;
				}
			}
			return undefined;
		}

		self.getUsersIds = function () {
			var ids = []
			for(i in self.users) {
				ids.unshift(self.users[i].user_id);
			}
			return ids;
		};

		return self;
	};

	global.Room = Room;
}(typeof window  === 'undefined' ? exports : window));