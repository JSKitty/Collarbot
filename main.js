'use strict';

// Native modules
const FS = require("fs");

// Custom modules
const colour = require("./lib/colours");

// NPM modules
const Discord = require("discord.js");
const WS = require("ws");

// Parse config file
const CONFIG = JSON.parse(FS.readFileSync("config.json", "utf-8"));

// Create an instance of a Colla-rs client socket
const ws = new WS(CONFIG.collar_server);

ws.on('open', () => {
    console.log(colour.green("Collar: ") + 'Connected!');
});
  
ws.on('message', (data) => {
    console.log(colour.yellow("Collar: ") + 'Received: %s', data);
});

// Create an instance of a Discord client
const discord = new Discord.Client();
discord.on("ready", () => {
    console.log(colour.green("Discord: ") + "Connected!");
});

let cDepriveInterval = null;
discord.on('message', async (msg) => {
    // Only register 'admin' or 'pet' messages, unless `allow_anyone` is enabled
    if (!CONFIG.allow_anyone && (!CONFIG.admins.includes(msg.author.id) && msg.author.id !== CONFIG.pet)) return;
    const text = msg.content;
    const textLower = msg.content.toLowerCase();
    const params = msg.content.split(' ');
    if (params[0]) params[0] = params[0].replace(CONFIG.prefix, '');
    const command = params[0].toLowerCase();

    // A message starting with 'za' and ending with 'p' is a variable-strength shock, length measured by characters, and strength measured by caps
    if (textLower.startsWith('za') && textLower.endsWith('p')) {
        let nStrength = 15; // a range from 0 to `CONFIG.max_strength`
        let nLength = 400;  // milliseconds from 400 to `CONFIG.max_length`

        // Scroll every letter, accounting for it's attributes
        for (const char of text) {
            // Must be an 'a', regardless of casing
            if (char.charCodeAt() != 65 && char.charCodeAt() != 97) continue;
            nLength += CONFIG.per_char_length;

            // Capital = higher strength
            if (isCap(char)) nStrength += CONFIG.per_char_strength;
        }

        // Safety first!
        if (nStrength > CONFIG.max_strength) nStrength = CONFIG.max_strength;
        if (nLength > CONFIG.max_length) nLength = CONFIG.max_length;

        console.log(colour.green('Discord: ') + 'Executing zap of %s and %s', colour.yellow(nStrength + ' strength'), colour.yellow((nLength / 1000) + ' seconds'));

        // Prepare Colla-rs formatted command payload
        const payload = {
            "mode": "zappy",
            "level": nStrength,
            "duration": nLength
        }

        // Push payload to the Colla-rs server
        ws.send(JSON.stringify(payload));

        // A cute little acknowledgement
        msg.react("⚡");
    } else {
        // Only register correctly prefixed messages here
        if (text.startsWith(CONFIG.prefix)) {
            if (command === 'challenge') {
                let pet_id = null;
                // Optional: select a pet to DM directly
                if (params[1]) {    
                    let sanitised_id = params[1].replace('<@', '').replace('>', '');
                    if (sanitised_id === CONFIG.pet) {
                        pet_id = params[1]
                    }
                }
                let base_time = CONFIG.timer_base_seconds;
                // Optional: add minutes onto the timer to give the pet some help
                if (params[2] && Number(params[2]) > 0) {
                    base_time = Number(params[2]) * 60;
                }
                await generateChallenge(msg, pet_id, base_time);
            }

            if (command === 'deprive' || command === 'loop') {
                if (cDepriveInterval) return msg.react('❌');
                let pet_id = null;
                // Select a pet to DM directly
                if (params[1]) {    
                    let sanitised_id = params[1].replace('<@', '').replace('>', '');
                    if (sanitised_id === CONFIG.pet) {
                        pet_id = params[1]
                    }
                }
                if (!pet_id) return msg.reply('A pet must be selected for sleep deprevation mode!');

                let base_time = 0;
                // Choose the interval, give/take randomness
                if (params[2] && Number(params[2]) > 0) {
                    base_time = Number(params[2]) * 60;
                }
                if (base_time === 0) return msg.reply('An interval (in hours) must be selected for sleep deprevation mode!');

                // Start deprive/loop mode
                cDepriveInterval = setInterval(function () {
                    generateChallenge(msg, pet_id, CONFIG.timer_base_seconds);
                }, base_time * 1000 * 60);

                msg.reply('Started! Running puzzles for <@' + pet_id + '> at an interval of ' + base_time + ' minutes');
            }

            if (command === 'cancel') {
                clearInterval(cDepriveInterval);
                cDepriveInterval = null;
                challengeClear();
                msg.reply('Cancelled all existing challenges and deprive/loop mode!');
            }
        } else {
            // un-prefixed messages
            if (cActiveChallenge.type >= 0) {
                // Pets and Admins can answer challenges
                if (CONFIG.pet === msg.author.id || CONFIG.admins.includes(msg.author.id)) {
                    if (params.find(a => a == cActiveChallenge.answer)) {
                        challengeComplete();
                    }
                }
            }
        }
    }
});

// Enum of challenge types for easy management
const CHALLENGE = {
    MATHS: 0,
    //TEXT: 1
}
Object.freeze(CHALLENGE);

// Generate a random challenge game
let cActiveChallenge = {
    type: -1,
    timer: null,
    answer: 0,
    channel: null
};
async function generateChallenge(msg, pet_id, base_time) {
    if (cActiveChallenge.type >= 0) return msg.react('⌛');

    // Decide if public (channel) or private (pet DM) challenge
    let pet_user = null;
    if (pet_id) {
        pet_user = await discord.users.fetch(pet_id, true, true);
        cActiveChallenge.channel = pet_user;
    } else {
        cActiveChallenge.channel = msg.channel;
    }

    const nRandType = Math.floor(Math.random() * Object.keys(CHALLENGE).length);
    if (nRandType === CHALLENGE.MATHS) {
        const nRandMode = Math.floor(Math.random() * 3);
        let nAnswer = 0;               // The final answer
        let nLeftOp = 0, nRightOp = 0; // Left and Right maths operations
        let nTimer = 0;                // Seconds to answer before punishment
        let strContent = '';

        if (nRandMode === 0) {
            // Subtraction
            nLeftOp  = Math.floor(Math.random() * 100);
            nRightOp = Math.floor(Math.random() * 100);
            nAnswer  = nLeftOp - nRightOp;
            nTimer   = Math.floor(base_time + (Math.random() * 20));
            strContent = nLeftOp + ' - ' + nRightOp;
        } else if (nRandMode === 1) {
            // Addition
            nLeftOp  = Math.floor(Math.random() * 100);
            nRightOp = Math.floor(Math.random() * 100);
            nAnswer  = nLeftOp + nRightOp;
            nTimer   = Math.floor(base_time + (Math.random() * 20));
            strContent = nLeftOp + ' + ' + nRightOp;
        } else {
            // Multiplication
            nLeftOp  = Math.floor(3 + (Math.random() * 20));
            nRightOp = Math.floor(3 + (Math.random() * 20));
            nAnswer  = nLeftOp * nRightOp;
            nTimer   = Math.floor(base_time + (Math.random() * 30));
            strContent = nLeftOp + ' * ' + nRightOp;
        }

        cActiveChallenge.type = nRandType;
        cActiveChallenge.answer = nAnswer;
        cActiveChallenge.timer = setTimeout(challengePunishment, nTimer * 1000);
        if (pet_user) {
            msg.reply('Challenge generated and sent to pet ' + pet_user.username + '! (' + strContent + ' = ' + nAnswer + '), ending in ' + (nTimer / 60).toFixed(2) + 'm');
        }
        const greeting = CONFIG.display.greetings[Math.floor(Math.random() * CONFIG.display.greetings.length)];
        const petname = CONFIG.display.petnames[Math.floor(Math.random() * CONFIG.display.petnames.length)];
        cActiveChallenge.channel.send(generateTemplate(greeting, petname) + '\n ⏳ **What is ' + strContent + '?**');
    }// else if (nRandType === CHALLENGE.TEXT) {

    //}
}

function generateTemplate(greeting, petname) {
    return CONFIG.display.pet_templates[Math.floor(Math.random() * CONFIG.display.pet_templates.length)]
                .replace('{}', greeting)
                .replace('{}', petname);
}

function challengeClear() {
    cActiveChallenge.type = -1;
    cActiveChallenge.answer = 0;
    cActiveChallenge.channel = null;
    clearTimeout(cActiveChallenge.timer);
    cActiveChallenge.timer = null;
}

function challengeComplete() {
    cActiveChallenge.channel.send('Good ' + CONFIG.display.petnames[Math.floor(Math.random() * CONFIG.display.petnames.length)] + '! 🐺🐾');
    console.log(colour.green('Challenge: ') + 'Complete! No zaps sent'));
    challengeClear();
}

function challengePunishment() {
    cActiveChallenge.channel.send('⚡⚡⚡');
    challengeClear();

    // Prepare Colla-rs formatted command payload
    const payload = {
        "mode": "zappy",
        "level": 15,
        "duration": 500 + Math.floor(Math.random() * 1000)
    }

    console.log(colour.green('Challenge: ') + 'Executing zap of %s and %s', colour.yellow(nStrength + ' strength'), colour.yellow((nLength / 1000) + ' seconds'));

    // Push payload to the Colla-rs server
    ws.send(JSON.stringify(payload));
}

// A quick charcode capitalisation check
const isCap = (char) => char.charCodeAt() >= 65 && char.charCodeAt() <= 90;

discord.login(CONFIG.discord_token);