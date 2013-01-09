/** Module dependencies **/

var express = require('express')
, http      = require('http')
, path      = require('path')
, faye      = require('faye')
, jqtpl     = require("jqtpl")
, cons      = require('consolidate')
, fs 		= require('fs')
//, RedisStore = require('connect-redis')(express)
//, redis = require('redis')
, OsomTalk  = require('./models/osomtalk.js').OsomTalk;

/** Configurations **/
global.frontEndConfig 	= require('./public/js/frontend_config.js').FrontEndConfig;
global.appConfig 		= require('./app_config.js').AppConfig;

/** Global Libraries **/
global.crypto 			= require('crypto');
global.OAuth 			= require('oauth').OAuth;
global.MongoClient 		= require('mongodb').MongoClient;

/** Global OsomTalk Classes **/
global.User 			= require('./public/js/user.js').User;
global.Room 			= require('./models/room_model.js').Room;
global.utils 			= require('./public/js/utils.js').utils;

global.osomtalk 		= new OsomTalk();

/** Add the analytics code if the file is present **/
fs.readFile('analytics.html', 'utf8', function (err,data) {
	if (err) {
		console.log("Couldn't find analytics code, if you wish to use one create the file 'analytics.html'");
		global.ANALYTICS = "";
	} else {
		global.ANALYTICS = data;
	}
});

var app = express();
app.configure ( function(){
	app.set('port', process.env.PORT || 3000);
	app.engine('html', cons.jqtpl);

	app.set('view engine', 'html');
	app.set('views', __dirname + '/views');
	app.use(express.bodyParser());

	app.use(express.cookieParser(appConfig.cookie_secret));
	app.use(express.session());
	
	/*toogle use of redis
	app.use(express.cookieParser());
	app.use(
  		express.session({
	  		store: new RedisStore({
	  			host: appConfig.osomtalk_session.host,
				pass: appConfig.osomtalk_session.pass,
				port: appConfig.osomtalk_session.port
	  		}),
	  		secret: appConfig.cookie_secret
	  	})
	 );*/

	app.use(require('less-middleware')({ src: __dirname + '/public' }));
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});


app.get('/', function(req, res) {
	res.render('index', {ANALYTICS: global.ANALYTICS});
});

app.get('/about', function(req, res) {
	res.render('about', {ANALYTICS: global.ANALYTICS});
});

app.get('/room/:room_id', function(req, res) {
	var room_id = req.params.room_id;
	
	if(room_id.length != 24) {
		res.redirect('/');
	}
	
	osomtalk.getRoom(room_id, function (room) {
		if ( typeof room !== "undefined" ) {
			data = {
				user: false,
				room: room,
				ANALYTICS: global.ANALYTICS
			};
			
			//In case of logged in user, add it to the template
			if (req.session.user !== undefined) {
				osomtalk.verifyPermission(req.session.user._id,	req.session.user.token, room_id,
					function(has_permission) {
						if (has_permission ) {
							data.user = req.session.user;
							osomtalk.addUserToRoom(data.user._id, room_id);
						} else {
							req.session.destroy();	
						}
						res.render('room', data);
					});	
			} else {
				res.render('room', data);
			}
		} else {
			//Chat room doesn't exists
			res.redirect('/');
		}
	});
});

/** Get all the room data **/
app.get('/rooms/get/:room_id', function(req, res){
	var room_id = req.params.room_id;
	osomtalk.getRoom(room_id, function (room) {
		if ( typeof room !== "undefined" ) {
			res.send(room.getData());
		}
	});
});

/** Get all the room data **/
app.get('/rooms/get_messages/:room_id', function(req, res){
	var room_id = req.params.room_id;
	osomtalk.getMessages(room_id, function (messages) {
		if ( typeof messages !== "undefined" ) {
			res.send(messages);
		}
	});

});

/** Get all the users from room **/
app.get('/rooms/get_users/:room_id', function(req, res){
	var room_id = req.params.room_id;
	osomtalk.getUsersFromRoom(room_id, function(users){
		if ( typeof users !== "undefined" ) {
			res.send(users);
		}
	});
});


/** Checks for username and take it in case is valid. **/
app.get('/user/ping/:room_id', function(req, res){
	var room_id = req.params.room_id;
	if( osomtalk.roomExists(room_id)) {
		if(req.session.user!==undefined) {
			osomtalk.pingUser(room_id, req.session.user.user_id);
			res.send({response: 'success'});
		}
		return true;
	}
	res.send({error: 'UNEXISTANT_ROOM'});
});

/** Delete Message **/
app.post('/delete_message/:room_id/:message_id', function(req, res){
	var room_id = req.params.room_id;
	var message_id = req.params.message_id;
	var user_id = req.body.user_id;
	var token = req.body.token;
	
	osomtalk.verifyPermission(user_id, token, room_id, function (has_permission) {
		if(has_permission) {
			if (user_id=== req.session.user.user_id) {	
				osomtalk.deleteMessage(room_id, message_id);
				res.send();
			}
		} else {
			res.send({error: 'NO_PERMISSION'});
		}
	});
});

/** Reply Message **/
app.post('/reply_message/:room_id/:message_id', function(req, res){
	var room_id = req.params.room_id;
	var message_id = req.params.message_id;
	var user_id = req.body.user_id;
	var token = req.body.token;
	var text = req.body.text;
	
	osomtalk.verifyPermission(user_id, token, room_id, function (has_permission) {
		if(has_permission) {
			osomtalk.replyMessage(room_id, message_id, user_id, text);
			res.send();
		}else {
			res.send({error: 'NO_PERMISSION'});
		}
	}); 
});

/** creates a new room and then returns the generated id. **/
app.post('/rooms/create', function(req, res){
	if(req.body.name.length > 20) {
		res.send({error:'TOO_LONG'});	
		return false;
	}
	
	var room_id = osomtalk.addRoom({name:req.body.name});
	var welcomeMessage = 
	   ['#Welcome to OsomTalk',
		'OsomTalk isn\'t like any other chat out there, here you can.',
		'',
		'* Use MarkDown Syntax -> http://daringfireball.net/projects/markdown/syntax',
		'* Have youtube videos inserted by just pasting the link-> http://youtu.be/vbrII7frHV0',
		'* Even images (gifs included) are inserted without any fuzz -> http://i0.kym-cdn.com/photos/images/original/000/090/603/258witx.gif',
		'',
		'Have fun using with **OsomTalk!**',
		'',
		'PD: This Message was written directly in OsomTalk, isn\'t that OSOM.'
	   ].join('\n');
	
	osomtalk.addMessageToRoom(room_id, {
		text: welcomeMessage,
		type: 'OFFICIAL',
	});

	console.log('Room Created: ' + room_id + '(' + req.body.name + ')');
	res.send({id:room_id});
});

/** Start's the oAuth Dance (is much more natural in node by the way) **/
app.get('/auth/twitter', function(req, res){
	req.session.oauth = {};
	req.session.oauth.referer = req.header('Referer');
	if ( req.session.user===undefined ) {
		osomtalk.oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
			if (error) {
				console.log(error);
				res.send("yeah no. didn't work.")
			} else {
				req.session.oauth.token = oauth_token;
				req.session.oauth.token_secret = oauth_token_secret;
				res.redirect('https://twitter.com/oauth/authenticate?oauth_token='+oauth_token)
			}
		});
	} else {
		res.redirect(req.session.oauth.referer);    
	}
});

/** Coming back from twitter **/
app.get('/auth/twitter/callback', function(req, res, next){
	if (req.session.oauth) {
		req.session.oauth.verifier = req.query.oauth_verifier;
		var oauth = req.session.oauth;

		osomtalk.oa.getOAuthAccessToken(oauth.token,oauth.token_secret,oauth.verifier, 
			function(error, oauth_access_token, oauth_access_token_secret, results){
				if (error){
					console.log(error);
					res.send("yeah something broke.");
				} else {
					req.session.user = osomtalk.addUser({
						type: 'TWITTER',
						username: results.screen_name,
						twitter_id: results.user_id,
						access_token:  oauth_access_token,
						access_token_secret: oauth_access_token_secret
					}, function(user) {
						req.session.user= user;
						res.redirect(req.session.oauth.referer);
					});
					
				}
			});
	} else {
		next(new Error("you're not supposed to be here."));
	}
});

/** Checks for username and take it in case is valid. **/
app.get('/user/take/', function(req, res){
	var response = osomtalk.validateUserName(req.query.username);
	if (  response !== true) {
		res.send({error: response.error });
		return false;
	} else {
		osomtalk.addUser({username: req.query.username, type:'ANONYMOUS'}, function(user){
			if ( user == false) {
				res.send({error: 'NAME_TAKEN'});
				return false;
			}
			req.session.user = user;
			res.send(user);
		});
	}
});

var server = http.createServer(app);
var faye_server = new faye.NodeAdapter({mount: '/faye'});

var extension = {
	incoming : function(message, callback) {
		if(message.channel.substring(0,10) === '/messages_') {
			var message_text = message.data.text;
			var user_id   = message.data.user_id;
			var token 		 = message.data.token;
			var room_id      = message.channel.substring(10);
			
			var block='';
			/*if ( !osomtalk.roomExists(room_id) && !osomtalk.userExists(user_id) ) {
				block = 'NOT_EXIST';
			} else {
				if ( !osomtalk.verifyPermission(user_id, token, room_id) ) {
					block = "NO_PERMISSION";
				} else {*/
					result = osomtalk.validateMessage(message_text);
					if (result.error !==undefined) {
						block = result.error; //EMPTY & TOO_LONG
					} else {
						result = osomtalk.validateSpam(user_id, room_id)
						if (result.error !== undefined) {
							block = result.error; //TYPING & FLOODING
						}
					}
				/*}
			}*/
			if (!block) {
				var data = {
					text: message_text,
					user_id: user_id,
					type: 'USER'
				}
				osomtalk.addMessageToRoom(room_id, data);    
			} else {
				message.error = block;
			}
		}
		callback(message);
	}
};
faye_server.addExtension(extension);

server.listen(appConfig.port);
faye_server.attach(server);

console.log("Express server listening on port " + osomtalk.port);

client = new faye.Client(osomtalk.url + '/faye');