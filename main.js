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

discord.on('message', msg => {
    // Only register 'admin' messages, unless `allow_anyone` is enabled
    if (!CONFIG.allow_anyone && !CONFIG.admins.includes(msg.author.id)) return;
    const text = msg.content;
    const textLower = msg.content.toLowerCase();

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
        // Only register correctly prefixed messages, and only if there's anything to process
        if (!text.startsWith(CONFIG.prefix) && text.length > CONFIG.prefix.length) return;
        
        // TODO: add any commands here, i.e: text-based configuration and settings
    }
});

// A quick charcode capitalisation check
const isCap = (char) => char.charCodeAt() >= 65 && char.charCodeAt() <= 90;

discord.login(CONFIG.discord_token);