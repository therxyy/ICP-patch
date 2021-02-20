var Istrolid = require('./istrolid.js');
var ladder = [];

class LadderPlayer{
    name;
    elo;
    constructor(name) {
        this.name = name;
        this.elo = 500;
    }

}


function addPlayerToLadder(name){
    for( LadderPlayer in ladder){
        if (ladderPlayer.name === name) {
            sim.say("Player already in ladder!")
        } else {
            ladder.push(new LadderPlayer(name));
            "Player "+name+"Added to ladder."
        }

    }


}