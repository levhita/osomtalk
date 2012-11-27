(function (global){

var Room = function(config){
	config = config || {};
	var self = {};
	
	self.id			= config.id;
	self.name		= config.name || '';
	self.users  	= config.users || [];
	self.messages 	= config.messages || [];
	
	self.getRoom = function () {
		return {id:self.id, name:self.name, messages:self.messages, users:self.users};
	};
	
	self.getMessages = function () {
		return self.messages;
	};

	self.setMessages = function(messages) {
		self.messages = messages;
	}
	
	self.getUsers = function () {
		return self.users;
	};
	
	self.addUser = function(user) {
		self.users.push(user);
	};

	self.addMessage = function(text) {
		var message = {
			time: Math.round(+new Date()/1000),
			user: 'Test',
			text: text
		}
		
		if ( typeof window  !== 'undefined' ) {
			self.renderMessage(message);
		} else {
			//If you ever need to have the messages as data on the client side, take this line out of the if
			self.messages.push(message);
			if ( self.messages.length > 100 ) {
				//Maximum of 100 messages in memory for each chat on the server chat
				console.log('deleting extra message', self.messages.shift());
			}
		}
	};
	
	self.renderMessage = function (message) {
		var previewsHTML = utils.getPreviewsHTML(message.text);
		$('#messages').prepend('<div class="message"><span class="time">'+message.time +'</span> : <span class="user">'+message.user +'</span><br/>' + utils.markdown(message.text) + '</div>'+previewsHTML+'<hr/>');
	}
	
	/** renders the chat **/
	self.renderRoom = function() {
		/** Render Messages **/
		for(var i = 0; i < self.messages.length; i++) {
			self.renderMessage(self.messages[i]);
		}
	};
	
	/** Connections with web services **/
	/** Gets full room data **/
	self.getRoomData = function(callback){
		$.ajax({
			url: '/rooms/get/'+ self.id,
			success: function(data) {
				self.name = data.name;
				self.users = data.users;
				self.messages = data.messages;
				callback();
			}
		});
	};

	self.subscribe = function(client) {
		client.subscribe('/messages'+ self.id, function(message) {
			self.addMessage(message.data.text, message.clientID);
		});
	}
	
	return self;
};

global.Room = Room;
}(typeof window  === 'undefined' ? exports : window));