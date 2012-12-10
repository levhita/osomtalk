/** Module dependencies **/

var express = require('express')
, http      = require('http')
, path      = require('path')
, faye      = require('faye')
, jqtpl     = require("jqtpl")
, cons      = require('consolidate')
, crypto    = require('crypto')
, OAuth     = require('oauth').OAuth
, OsomTalk  = require('./models/osomtalk.js').OsomTalk
, Room      = require('./public/js/room.js').Room
, User      = require('./public/js/user.js').User
, utils     = require('./public/js/utils.js').utils;

global.OAuth = OAuth;
global.User = User;
global.Room = Room;
global.utils = utils;

var osomtalk = new OsomTalk({
	url: "http://localhost:3000",
	port: 3000,
	consumer_key: "WRUKIvt5FAsvs43NKnYJzA",
	consumer_secret: "g2AIdoR16IB6iDXPnKf8fJZMVZsUDOswikl7VQU19k"
});

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
	app.use(express.cookieParser('nunca descubriras mi secreto!'));
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
		if (req.session.user !== undefined) data.user = req.session.user;
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
	var room = osomtalk.addRoom({name:req.body.name});
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
			if ( osomtalk.rooms[room_id]!==undefined && osomtalk.users[identifier]!==undefined ) {
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
				var data = {
					data: {
						time: Math.round(+new Date()/1000),
						text: message_text,
						username: osomtalk.users[identifier].username,
						identifier: identifier,
					}
				}
				osomtalk.rooms[room_id].addMessage(message.data);    
				client.publish('/server_messages_' + room_id, data);
			} else {
				console.log('returning the message to room ' + room_id);
				message.error = block;
			}
			
		}
		callback(message);
	}
};
faye_server.addExtension(extension);

server.listen(osomtalk.port);
faye_server.attach(server);

console.log("Express server listening on port " + osomtalk.port);

client = new faye.Client(osomtalk.url + '/faye');

osomtalk.addRoom({room_id:'ibgdl', name:'IBGDL'});
osomtalk.addRoom({room_id:'osombeta', name:'OsomTalk Beta'});
osomtalk.addRoom({room_id:'hackergarage', name:'HackerGarage'});

/*rooms['ibgdl'] = new Room({id:'ibgdl', name:'IBGDL Crew!'}); 
rooms['osombeta'] = new Room({id:'osombeta', name:'OsomTalk Beta'}); 
rooms['hackergarage'] = new Room({id:'hackergarage', name:'HackerGarage'}); */

