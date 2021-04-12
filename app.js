const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

var history = {};

var turnCounter = 0;
var maxTurn = 20;   //21
//var roles = [0, 1, 2];
var roles = [0, 1, 2];
var playersCount = 3;
var activeUsers = 0;
var playing = false;

//TODO: Queue for multiple messages, such as chat
var commands = [];

function sendMessage(type, data)
{
    //Check how many users are connected, if not all are connected, queue the message,
    //Everytime player is reconnected, check if any messages are queued, if yes then resend message until it is sent
    //Chats can be sent multiple times, queue in array and then send them to others or perhaps dont have local execution and only server

    if(activeUsers < playersCount)
    {
        let command = {};
        command.type = type;
        command.data = data;
        commands.push(command);
        console.log('Queueing server message!');
    }
    else
    {
        io.emit(type, data);
        console.log('Executed queued message!');
    }
}

function setupListeners(socket)
{
    //TODO: If other clients are reconnecting the message is lost, perhaps keep tabs of who's connected and who isn't

    socket.on('end-turn', (data) => {
        let msg = JSON.parse(data);

        turnCounter++;
        let out = {};
        out.role = turnCounter % playersCount;

        let turn = {};
        turn.player_role = msg.role;
        turn.doughnut = msg.doughnut;       //FORMAT
        turn.blocks = [];
        
        msg.blocks.forEach(block => {
            turn.blocks.push(JSON.parse(block));
        });

        turn.overwritten = msg.overwriteReason != "";
        turn.overwrite_reason = msg.overwriteReason;

        turn.metrics = {};
        turn.metrics.residential = msg.residentialMetric;
        turn.metrics.green_score = msg.greenMetric;
        turn.metrics.revenue = msg.revenueMetric;

        history.turns.push(turn);
        
        //TODO: Check if game ended
        //TODO: Send Image
        if(turnCounter > maxTurn)
        {
            sendMessage('end-game', out);
            //TODO: Save to file JSON
        }
        else
        {
            console.log(turnCounter);
            sendMessage('turn', out);
        }
        
    });

    socket.on('build', (data) => {
        let msg = JSON.parse(data);
        console.log(data);
        //io.emit('build', data);
        sendMessage('build', msg);
    });

    socket.on('chat', (data) => {
        let msg = JSON.parse(data);
        console.log(data);
        //io.emit('chat', data);
        recordChat(msg.role, msg.message);
        sendMessage('chat', msg);
    });
}

io.on('connection', (socket) => {
    socket.on('disconnect', function() {
        console.log('User Disconnected!');
        activeUsers = activeUsers - 1;
    });

    if(playing)
    {
        socket.emit('reconnect-q');
        socket.on('reconnect-a', (val) => {
            console.log("Reconnected User!");
            activeUsers = activeUsers + 1;
            setupListeners(socket);

            /*
            if(command != null)
            {
                //There is message queued
                sendMessage(command.type, command.data);
            }
            */

            if(commands.length > 0)
            {
                //There's a queue of messages
                let queue = commands;
                commands = [];
                queue.forEach(command => {
                    sendMessage(command.type, command.data);
                });
            }

        });
        return;
    }
    else
    {
        //Player connected
        //Get random role
        console.log('User Connected!');
        activeUsers = activeUsers + 1;
    
        let sel = Math.floor(Math.random() * roles.length);
        socket.emit('role', roles[sel]); //Send what role is assigned
        console.log("Assigned Role: " + roles[sel]);
        roles.splice(sel, 1); //Delete the already used role

        if(roles.length == 0)
        {
            //Record Game!
            recordStart();

            console.log("Ready!");
            io.emit('ready', 'null');
            playing = true;
            let msg = {};
            msg.role = 0
            console.log("Turn 1!");
            io.emit('turn', msg);
        }
    }

    //All of the commands init
    setupListeners(socket);
});

const server = http.listen(process.env.PORT, () => {
    console.log("Connected at " + server.address().port);
});

//Data recording
function recordStart()
{
    history.game_id = uuidv4();
    history.neighbourhood_id = "new-cross";
    let date = new Date();
    history.date = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
    history.turns = [];
    history.chat_log = [];
}

function recordChat(who, what)
{
    let chat = {};
    chat.who = who;
    chat.what = what;

    history.chat_log.push(chat);
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}