/** Module dependencies **/

var express = require('express')
, http		= require('http')
, path		= require('path')
, faye      = require('faye')
, jqtpl		= require("jqtpl")
, cons		= require('consolidate')
, crypto	= require('crypto');

var app = express();

var Room = require('./public/js/room.js').Room;
var utils = require('./public/js/utils.js').utils;

var rooms = [];
var clients = [];
users = [];

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
	app.use(express.cookieParser('nunca descrubriras mi secreto!'));
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

	app.get('/room/:id', function(req, res) {
		var id = req.params.id;
		if(id in rooms) {
			if (req.session.identifier === undefined) {
				res.render('room', {
					error: "NAMELESS",
					room_id: id,
					room_name:rooms[id].name}
					);
			} else {
				res.render('room', {
					error: "",
					username: req.session.username,
					token: req.session.token,
					identifier: req.session.identifier,
					room_id: id,
					room_name:rooms[id].name});	
			}
		} else {
			res.redirect('/');
		}
	});

/** Get all the room data **/
app.get('/rooms/get/:id', function(req, res){
	var id = req.params.id;
	if ( id in rooms ) {
		res.send(rooms[id].getRoom());
	}
});

/** Get all the room data **/
app.get('/user/take/', function(req, res){
	var username = req.query.username.toLowerCase().replace(/^\s\s*/, '').replace(/\s\s*$/, '');

	/**Check For Empty**/
	if (username=='') {
		res.send({error: 'EMPTY'});
		return true;
	}

	/**Check For Too Long**/
	if (username.length > 12) {
		res.send({error: 'TOO_LONG'});
		return true;
	}

	/** Check For Duplicates **/
	var match = false;
	console.log(users);
	var i = users.length-1;
	for(var key in users) {
		console.log("Checking " + users[key].username);
		console.log(" Against " + username);
    	if (users[key].username===username) {
    		match = true;
    		break;
    	}
    }
	if(match) {
		res.send({error: 'NAME_TAKEN'});
		return true;
	}
	
	if(req.session.identifier === undefined) {
		console.log('New user requesting: ' + username);
		req.session.identifier = utils.makeId(11);
		req.session.username = username;
		var hmac = crypto.createHmac('sha256', 'anyquerykey');
		req.session.token  = hmac.update(req.session.username).digest('hex');
		
		users[req.session.identifier] = {
			username: username,
			token: req.session.token,
			identifier: req.session.identifier
		}
	} /*else {
	console.log('Current user requesting: ' + username);
	req.session.username = username;
	req.session.token  = hmac.update(req.session.username).digest('hex');
	users[req.session.identifier].username = req.session.username;
	users[req.session.identifier].token = req.session.token;
	users[req.session.identifier].identifier = req.session.identifier;
	}*/
	res.send( {username:req.session.username, token: req.session.token} );
	
});

/** creates a new room and then returns the generated id. **/
app.post('/rooms/create', function(req, res){
	/** Generates an unused room id **/
	do {
		id = utils.makeId(7);    
	} while (rooms[id] !== undefined);

	room = new Room({id:id, name:req.body.name});
	//room.subscribe(client);
	rooms[id] = room;

	console.log('Room Created: ' + id + '(' + req.body.name + ')');
	res.send({id:id});
});

var server = http.createServer(app);
var faye_server = new faye.NodeAdapter({mount: '/faye'});

var extension = {
    incoming : function(message, callback) {
        if(message.channel.substring(0,10) === '/messages_') {
        	var room_id = message.channel.substring(10);
        	if ( (message.data.text!=='') && (rooms[room_id]!==undefined && users[message.data.identifier]!==undefined) ) {
           		//console.log('Checking flooding on message');
  		
           		var sender ='';
           		var block = '';
           		var current_time = Math.round(+new Date()/1000);
           		
           		if ( message.data.text.length >1024 ) {
					block = 'BLOCKED_LARGE';
           		} else if ( clients[message.clientId] === undefined ) {
           			clients[message.identifier] = {
           				last: 0,
           				times: []
           			};
           		} else if ( (current_time - clients[message.identifier].last) > 1 ){
           		    var i_time = 0;
           		    do {
           		    	i_time = clients[message.identifier].times.shift();
           		    } while( (current_time - i_time) > 60 );
           		    clients[message.identifier].times.unshift(i_time);
         			
         			console.log(clients[message.identifier].times.length);
         			
         			if ( clients[message.identifier].times.length > 15) {
         				console.log('Blocking ' + message.identifier + ' For _flooding_');
         				block = 'BLOCKED_FLOODING';
         			}
           		} else {
           			console.log('Blocking ' + message.identifier + 'For _fast typing_');
           			block = 'BLOCKED_TYPING';
           		}
           		clients[message.identifier].last = current_time;
           		clients[message.identifier].times.push(current_time);
           		
           		//console.log(clients[message.clientId].times.length);
           		//console.log(clients[message.clientId].times);
           		//console.log(current_time - 60);
           		var data = {
					data: {
						time: Math.round(+new Date()/1000),
						text: message.data.text,
						username: users[message.data.identifier].username,
						identifier: message.identifier,
					}
				}
           		if (!block) {
	           		//console.log('Publishing Message to room: ' + room_id);
					rooms[room_id].addMessage(message.data);	
					client.publish('/server_messages_' + room_id, data);
				} else {
					console.log('returning the message to room ' + room_id);
					message.error = block;
				}
			}
            
		}
        callback(message);
    }
};
faye_server.addExtension(extension);


//server.listen(3000);
server.listen(80);

faye_server.attach(server);

console.log("Express server listening on port 80");

//client = new faye.Client('http://localhost:3000/faye');
client = new faye.Client('http://osomtalk.jit.su/faye');

rooms['ibgdl'] = new Room({id:'ibgdl', name:'OsomTalk Beta, For the IBGDL Crew!'}); 
//rooms['ibgdl'].subscribe(client);
