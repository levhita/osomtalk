/** Module dependencies **/

var express = require('express')
, http      = require('http')
, path      = require('path')
, faye      = require('faye')
, jqtpl     = require("jqtpl")
, cons      = require('consolidate')
, OsomTalk  = require('./models/osomtalk.js').OsomTalk

global.appConfig = require('./app_config.js').AppConfig;
global.frontEndConfig = require('./public/js/frontend_config.js').FrontEndConfig;
global.crypto = require('crypto');
global.OAuth = require('oauth').OAuth;
global.User = require('./public/js/user.js').User;
global.Room = require('./public/js/room.js').Room;
global.utils = require('./public/js/utils.js').utils;

var osomtalk = new OsomTalk();

var app = express();

app.configure ( function(){
	app.set('port', process.env.PORT || 3000);
	app.engine('html', cons.jqtpl);

	app.set('view engine', 'html');
	app.set('views', __dirname + '/views');

	//app.use(express.favicon());
	//app.use(express.logger('dev'));
	//app.use(express.methodOverride());
	//app.use(app.router);
	app.use(express.bodyParser());
	app.use(express.cookieParser(appConfig.cookiesecret));
	app.use(express.session());
	

	app.use(require('less-middleware')({ src: __dirname + '/public' }));
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});


app.get('/', function(req, res) {
	res.render('index');
});

app.get('/room/:room_id', function(req, res) {
	var room_id = req.params.room_id;
	if ( room = osomtalk.getRoom(room_id) ) {
		data = {user: false, room: room};
		//In case of logged in user, add it to the template
		if (req.session.user !== undefined) {
			data.user = req.session.user;
			osomtalk.addUserToRoom(identifier, room_id);
		} 
		res.render('room', data);
	} else {
		//Chat room doesn't exists
		res.redirect('/');
	}
});

/** Get all the room data **/
app.get('/rooms/get/:room_id', function(req, res){
	var room_id = req.params.room_id;
	if( room = osomtalk.getRoom(room_id)) {
		res.send(room.getRoom());
	}
});

/** Checks for username and take it in case is valid. **/
app.get('/user/take/', function(req, res){
	var response = osomtalk.validateUserName(req.query.username);
	if (  response !== true) {
		res.send({error: username.error });
		return false;
	} else {
		var user = osomtalk.addUser({username: req.query.username})
		if ( user == false) {
			res.send({error: 'NAME_TAKEN'});            
		}
	}
	req.session.user = user;
	res.send(user);
});

/** creates a new room and then returns the generated id. **/
app.post('/rooms/create', function(req, res){
	if(req.body.name.length > 20) {
		res.send({error:'TOO_LONG'});	
		return false;
	}
	
	var room = new osomtalk.addRoom({name:req.body.name});
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
	var timestamp = Math.round(+new Date()/1000);
	room.addMessage({
		id: timestamp + "OSOM",
		time: timestamp,
		text: welcomeMessage,
		user: {username: 'OsomTalk Bot', type: 'OFFICIAL'},
		identifier: 'OSOM'
	});

	console.log('Room Created: ' + room.id + '(' + room.name + ')');
	res.send({id:room.id});
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
					});
					res.redirect(req.session.oauth.referer);
				}
			});
	} else {
		next(new Error("you're not supposed to be here."));
	}
});

var server = http.createServer(app);
var faye_server = new faye.NodeAdapter({mount: '/faye'});

var extension = {
	incoming : function(message, callback) {
		if(message.channel.substring(0,10) === '/messages_') {
			var message_text = utils.trim(message.data.text);
			var identifier   = message.data.identifier;
			var room_id      = message.channel.substring(10);
			
			var block='';
			if ( !osomtalk.roomExists(room_id) && !osomtalk.userExists(identifier) ) {
				block = 'NOT_EXIST';
			} else {
				result = osomtalk.validateMessage(message_text);
				if (result.error !==undefined) {
					block = result.error; //EMPTY & TOO_LONG
				} else {
					result = osomtalk.validateSpam(identifier, room_id)
					if (result.error !== undefined) {
						block = result.error; //TYPING & FLOODING
					}
				}
			}
			if (!block) {
				var user = osomtalk.getUser(identifier);
				var timestamp = Math.round(+new Date()/1000);
				var data = {
					id: timestamp + identifier,
					time: timestamp,
					text: message_text,
					user: {username:user.username, type:user.type},
					identifier: identifier,
				}
				osomtalk.rooms[room_id].addMessage(data);    
				
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

osomtalk.addRoom({room_id:'ibgdl', name:'IBGDL'});
osomtalk.addRoom({room_id:'osombeta', name:'OsomTalk Beta'});
osomtalk.addRoom({room_id:'hackergarage', name:'HackerGarage'});