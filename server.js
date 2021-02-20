var config = require('./config.json');
var WebSocket = require('ws');
require('./fix');
var Istrolid = require('./istrolid.js');
const allowedCmds = ["playerJoin", "mouseMove", "playerSelected", "setRallyPoint", "buildRq", "stopOrder", "holdPositionOrder", "followOrder", "selfDestructOrder", "moveOrder", "configGame", "startGame", "addAi", "switchSide", "kickPlayer", "surrender","requestChanges"]
global.sim = new Sim();
Sim.prototype.cheatSimInterval = -10;
Sim.prototype.lastSimInterval = 0;

let changes = require('./changes.json');


global.Server = function() {
    var wss = new WebSocket.Server({port: process.env.PORT || config.port});
    var root = null;

    var players = {};

    var lastInfoTime = 0;

    this.send = (player, data) => {
        let packet = sim.zJson.dumpDv(data);
        let client = player.ws;
        if(client && client.readyState === WebSocket.OPEN) {
            client.send(packet);
        }
    };
    this.sendToRoot = (data) => {
        root.sendData(data);
    };
    this.stop = () => {
        console.log("stopping server");
        wss.close();
        clearInterval(interval);
    };
    this.say = msg => {
        root.sendData(['message', {
            text: msg,
            channel: config.name,
            color: "FFFFFF",
            name: "Server",
            server: true
        }]);
    };
    var connectToRoot = () => {
        root = new WebSocket(config.root_addr);
        root.on('open', () => {
            console.log("connected to root");
            sendInfo();
            lastInfoTime = now();
            root.send(JSON.stringify(["registerBot"]));
        });
        root.on("message", msg => {
            let data = JSON.parse(msg);
            if (data[0] === 'message') {
                onMessage(data[1]);
            }
        });
        root.on('close', () => {
            console.log("cannot connect to root, retrying");
            setTimeout(connectToRoot, 5000);
        });
        root.on('error', e => {
            console.log("connection to root failed");
        });
        root.sendData = data => {
            if(root.readyState === WebSocket.OPEN) {
                root.send(JSON.stringify(data));
            }
        }
    };
    var sendInfo = () => {
        // Send server info
        let info = {
            name: config.name,
            address: "ws://" + config.addr + ":" + config.port,
            observers: sim.players.filter(p => p.connected && !p.ai).length,
            players: sim.players.filter(p => p.connected && !p.ai).map(p => { return {
                name: p.name,
                side: p.side,
                ai: false
            }}),
            type: sim.serverType,
            version: VERSION,
            state: sim.state
        };
        root.sendData(['setServer', info]);
    };
    connectToRoot();
    wss.on('connection', (ws, req) => {
        console.log("connection from", req.connection.remoteAddress);
        let id = ws.id = req.headers['sec-websocket-key'];
        ws.on('message', msg => {
            let packet = new DataView(new Uint8Array(msg).buffer);
            let data = sim.zJson.loadDv(packet);
            //console.log(data);
            if(data[0] === 'playerJoin') {
                let player = sim.playerJoin(...data);
                player.ws = ws;
                players[id] = player;
                sim.clearNetState();
            }  else if (data[0] === 'requestChanges') {
                clientsWithNewChanges[id] = false;
            } else if(allowedCmds.includes(data[0])) {
                sim[data[0]].apply(sim, [players[id],...data.slice(1)]);
            }
        });
        ws.on('close', e => {
            if(players[id]) {
                players[id].connected = false;
                delete players[id];
                delete clientsWithNewChanges[id];
            }
        });
    });

    let clientsWithNewChanges = {},
        changesJSON = require('./changes.json');

    var interval = setInterval(() => {
        let rightNow = now();
        if(sim.lastSimInterval + 1000 / 16 + sim.cheatSimInterval <= rightNow) {
            sim.lastSimInterval = rightNow;
            if(!sim.paused) {
                sim.simulate();
            } else {
                sim.startingSim();
            }
            let packet = sim.send();
            wss.clients.forEach(client => {
                if(client.readyState === WebSocket.OPEN) {

                    if(clientsWithNewChanges[client.id]){client.send(packet)}
                    else {
                        client.send(sim.zJson.dumpDv({...packet, changes: changesJSON}));
                        clientsWithNewChanges[client.id] = true;
                    }
                }
            });
        }
        if(rightNow - lastInfoTime > 15000) {
            sendInfo();
            lastInfoTime = rightNow;
        }
    }, 17);
};
global.server = new Server();
// Remote repl
var repl = require('repl');
var net = require('net');
net.createServer(function (socket) {
    repl.start({
        input: socket,
        output: socket,
        terminal: true
    }).on('exit', () => socket.end());
    socket.on('error', () => {});
}).listen(5001, "localhost");

for (let i in changes) {
    let loc = i.split('.');
    parts[loc[0]].prototype[loc[1]] = changes[i];
}


//commands
function onMessage(data) {
    let {text, name, channel} = data;
    if (channel !== config.name) {
        return;
    }
    let args = text.split(' ');
    let command = args[0].toLowerCase();
    args.splice(0,1);
    switch (command) {
        case"!help":
            sim.say("commands are: !info, !changes, !script");
            break;
        case"!info":
            sim.say("therxyy's testing grounds");
            break;
        case"!restart":
            // var admins = ["therxyy","therx","therxy"]
            if(name === "therxyy" ||name ===  "therx" ||name ===  "therxy")
            {
                sim.say("restarting...")
                process.exit(1);
            }
            break;
        case"!changes":
            sim.say("https://docs.google.com/document/d/1Wf4OwW0_x1P4TCdeg2CsiHZGhrEocwKIZIjNUyGPBR8/edit?usp=sharing")
            break;

        case"!script":
            sim.say("Project github: https://github.com/therxyy/therxstrolid")
            sim.say("Apply changes: https://gist.github.com/therxyy/ff99bd3b9850bdd8985e261ea21c220f")
            break;

        case"!therx":
            sim.say("tester");
            if(name === "therxyy" ||name ===  "therx" ||name ===  "therxy") {
                sim.say("tester2")
                for (let player of sim.players) {
                    if (name === "therxyy" || name === "therx" || name === "therxy") {
                        if (player.name === name) {
                            player.host = true;
                            sim.say("rehosted to " + name + ".");

                        } else {
                            player.host = false;
                        }
                    }
                }
            }


                break;
            case"!ping":
                sim.say("pong");
                break;
            }
    }