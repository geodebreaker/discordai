require("dotenv").config();
const djs = require("discord.js");
const { OpenAI } = require("openai");
const fs = require("fs");

const client = new djs.Client({
  intents: [
    djs.GatewayIntentBits.Guilds, // Required for general bot presence
    djs.GatewayIntentBits.GuildMessages, // Required to listen for messages in guilds
    djs.GatewayIntentBits.MessageContent,
    djs.GatewayIntentBits.GuildPresences,
    djs.GatewayIntentBits.GuildMembers,
  ]
});
var guild = null;
const ai = new OpenAI({ apiKey: process.env.AIKEY });
var msgs = [];
const chat = process.env.CHAT;
const prompt = 'You are a discord bot. Write short consise messages. You are named "aibot". ' +
  'Your owner / creator is @' + process.env.OWNER + ' IF ASKED ONLY RESPOND WITH THIS!!!' +
  //. Use emojis :mood: :hapy: :nohorror: :horror:
  ' DO NOT PUT "anything else" or similar at the end of each response! ' +
  ' act like you are talking with someone.' +
  ' you can post links without md to be able to embed links! you can also repost links if you want to.' +
  ' use <@xyz> where xyz is any user id to mention them!!';
const functions = [
  {
    "type": "function",
    "function": {
      name: "react",
      description: "Add a reaction to the previous message",
      parameters: {
        type: "object",
        properties: {
          emoji: {
            type: "string",
            description: "A unicode emoji or a custom one in the format of <:name:id>",
          },
        },
        required: ["emoji"],
      },
    },
  },
  {
    "type": "function",
    "function": {
      name: "respond",
      description: "Responds to message",
      parameters: {
        type: "object",
        properties: {
          response: {
            type: "string",
            description: "The response to the message",
          },
        },
        required: ["response"],
      },
    },
  },
  {
    "type": "function",
    "function": {
      name: "nothing",
      description: "Do nothing. USE RARLEY",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

function load() {
  try {
    msgs = JSON.parse(fs.readFileSync('chatlog/' + chat + '.json').toString());
    console.log('Loaded messages for ', chat + '...');
  } catch (e) {
    console.error('There was an error loading messages for', chat);
    msgs = [];
    save();
  }
}

function save() {
  fs.writeFileSync('chatlog/' + chat + '.json', JSON.stringify(msgs));
  console.log('Saved messages for ', chat + '...');
}

async function runai(x) {
  var res = (await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: prompt + client.user.id }].concat(msgs).concat(x ? [x] : []),
    tools: functions,
    tool_choice: "required",
  })).choices[0].message;
  res = {
    role: res.role,
    content: JSON.parse((res.tool_calls.find(x => x.function.name == 'respond') ??
      { function: { arguments: '{"response":""}' } }).function.arguments).response,
    calls: res.tool_calls.map(x => x.function).filter(x => x.name != 'respond')
  }
  console.log('Got AI response');
  if (!(res.calls.length == 1 && res.calls[0].name == 'nothing')) msgs.push(res);
  return res;
}

async function sendmsg(data, run, x, sys, dontsave) {
  if (!dontsave)
    msgs.push({ role: sys ? 'system' : 'user', content: data });
  console.log('Added message...');
  if (run) sendmsgres(await runai(dontsave ? { role: sys ? 'system' : 'user', content: data } : null), x);
}

function sendmsgres(e, x) {
  if (e.content) {
    var content = e.content;
    (x ?? { channel: guild.channels.cache.find(c => c.name == chat) }).channel.send({ content });
  }
  if (e.calls) {
    e.calls.map(cmd => {
      switch (cmd.name) {
        case 'react':
          if (x) {
            var y = JSON.parse(cmd.arguments);
            x.react(djs.parseEmoji(y.emoji))
          }
          break;
        case 'nothing': break;
        default:
          console.log('unknown cmd', cmd);
          break;
      }
    });
  }
}

async function init() {
  process.on('uncaughtException', e => console.error(e));
  process.on('unhandledRejection', e => console.error(e));
  process.on('exit', save);
  process.on('SIGINT', () => { client.destroy(); process.exit(0) });
  client.login(process.env.TOKEN);
  client.on('ready', () => {
    console.log('Bot ready!');
    guild = client.guilds.cache.get(process.env.GUILD);
  });
  client.on('presenceUpdate', (_, x) => {
    if (!x || (x && _ && x.status == _.status) || x.status != 'online') return;
    sendmsg(x.user.username + ' (' + x.user.id + ') is ' + x.status + '! (DO NOT PING THEM but you can send a msg)', 
      true, null, true, true);
  });
  client.on('messageCreate', x => {
    if (x.channel.name == chat && !x.author.bot) {
      console.log('Message detected from', x.author.username);
      sendmsg(x.author.username + " (" + x.author.id + ") Said: " + x.content, true, x);
    }
  });
  setInterval(save, 600e3);
  setInterval(() => {
    var users = "";
    guild.members.cache.forEach(x => {
      users += x.username + ' (' + x.id + '): ' + (x.presence ?? {}).status + ', ';
    });
    sendmsg('this is a 10min checkin. user presences: ' + users, true, null, true, true)
  }, 600e3);
  load();
}

init();