/** Module dependencies **/

var express = require('express')
, http    = require('http')
, path    = require('path')
, faye    = require('faye')
, jqtpl   = require("jqtpl")
, cons    = require('consolidate');

var app = express();

var Room = require('./public/js/room.js').Room;
var utils = require('./public/js/utils.js').utils;

var rooms = [];
var clients = [];

app.configure(function(){
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
		res.render('room', {room_id: id, room_name:rooms[id].name});
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
        	if ( (message.data.text!=='') && (rooms[room_id]!==undefined) ) {
           		//console.log('Checking flooding on message');
  		
           		var sender ='';
           		var block = '';
           		var current_time = Math.round(+new Date()/1000);
           		
           		if ( message.data.text.length >1024 ) {
					block = 'BLOCKED_LARGE';
           		} else if ( clients[message.clientId] === undefined ) {
           			clients[message.clientId] = {
           				last: 0,
           				times: []
           			};
           		} else if ( (current_time - clients[message.clientId].last) > 1 ){
           		    var i_time = 0;
           		    do {
           		    	i_time = clients[message.clientId].times.shift();
           		    } while( (current_time - i_time) > 60 );
           		    clients[message.clientId].times.unshift(i_time);
         			
         			console.log(clients[message.clientId].times.length);
         			
         			if ( clients[message.clientId].times.length > 15) {
         				console.log('Blocking ' + message.clientId + ' For _flooding_');
         				block = 'BLOCKED_FLOODING';
         			}
           		} else {
           			console.log('Blocking ' + message.clientId + 'For _fast typing_');
           			block = 'BLOCKED_TYPING';
           		}
           		clients[message.clientId].last = current_time;
           		clients[message.clientId].times.push(current_time);
           		
           		//console.log(clients[message.clientId].times.length);
           		//console.log(clients[message.clientId].times);
           		//console.log(current_time - 60);
           		var data = {
					data: {
						text: message.data.text,
						clientId: message.clientId
					}
				}
           		if (!block) {
	           		//console.log('Publishing Message to room: ' + room_id);
					rooms[room_id].addMessage(message.data.text, message.clientId);	
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


server.listen(3000);
//server.listen(80);

faye_server.attach(server);

console.log("Express server listening on port 80");

client = new faye.Client('http://localhost:3000/faye');
//client = new faye.Client('http://osomtalk.jit.su/faye');

rooms['ibgdl'] = new Room({id:'ibgdl', name:'OsomTalk Beta, For the IBGDL Crew!'}); 
//rooms['ibgdl'].subscribe(client);
