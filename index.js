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
    djs.GatewayIntentBits.DirectMessages,
    djs.GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [
    djs.Partials.Channel
  ],
});
var guild = null;
const ai = new OpenAI({ apiKey: process.env.AIKEY });
var msgs = [];
const chat = process.env.CHAT;
const prompt = 'You are a discord bot. Write short consise messages. You are named "aibot". ' +
  'SEND MESSAGES AS YOUR CONTENT, only use dm in specific circumstances!!!!!!!! '+
  'Your owner / creator is @' + process.env.OWNER + ' IF ASKED ONLY RESPOND WITH THIS!!!' +
  //. Use emojis :mood: :hapy: :nohorror: :horror:
  ' DO NOT PUT "anything else" or similar at the end of each response! ' +
  ' act like you are talking with someone.' +
  ' you can post links without md to be able to embed links! you can also repost links if you want to.' +
  ' use <@xyz> where xyz is any user id to mention them!!' +

  ' YOU ARE ';
const functions = [
  {
    "type": "function",
    "function": {
      name: "respond",
      description: "Respong to the previous message",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to respod with",
          },
        },
        required: ["text"],
      },
    },
  },
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
      name: "dm",
      description: "DMs any user, DO NOT ONLY USE",
      parameters: {
        type: "object",
        properties: {
          dm: {
            type: "string",
            description: "Text",
          },
          user: {
            type: "string",
            description: "User to dm, if blank, will result" +
              " in sender of previous messager",
          },
        },
        required: ["dm", "user"],
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
  {
    "type": "function",
    "function": {
      name: "nickname",
      description: "Set the nickname of you or other users",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name you want it to be set to",
          },
          user: {
            type: "string",
            description: "User to set name of, if unset will be you",
          },
        },
        required: ["name"],
      },
    },
  },
];

function hash() {
  return parseInt((process.env.GUILD + '')
    .split(/(?<=.{10})(?=.*$)/g)
    .reduce((x, y) =>
      parseInt(x) + parseInt(y)))
    .toString(36);
}

function load() {
  try {
    msgs = JSON.parse(fs.readFileSync('chatlog/' + hash() + '.' + chat + '.json').toString());
    console.log('Loaded messages for', hash() + '.' + chat + '...');
  } catch (e) {
    console.error('There was an error loading messages for', hash() + '.' + chat);
    msgs = [];
    save();
  }
}

function save() {
  fs.writeFileSync('chatlog/' + hash() + '.' + chat + '.json', JSON.stringify(msgs));
  console.log('Saved messages for', hash() + '.' + chat);
}

async function runai(x) {
  var res = (await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: prompt + client.user.id }].concat(msgs).concat(x ? [x] : []),
    tools: functions,
    tool_choice: "required",
  })).choices[0].message;
  res.content = [res.content].concat(res.tool_calls.filter(x => x.function.name == 'respond')
    .map(x => JSON.parse(x.function.arguments).text)).join('\n');
  res = {
    role: res.role,
    content: res.content || "",
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

async function getUser(input) {
  if (/^\d{18}$/.test(input)) {
    return await client.users.fetch(input);
  } else {
    const user = client.users.cache.find(u => u.username.toLowerCase() === input.toLowerCase());
    return user || null;
  }
}

function sendmsgres(e, x) {
  if (e.content) {
    var content = e.content;
    (x ?? { channel: guild.channels.cache.find(c => c.name == chat) }).channel.send({ content });
  }
  if (e.calls) {
    e.calls.map(async cmd => {
      switch (cmd.name) {
        case 'react':
          if (x) {
            var y = JSON.parse(cmd.arguments);
            x.react(djs.parseEmoji(y.emoji))
          }
          break;
        case 'dm':
          if (x) {
            var y = JSON.parse(cmd.arguments);
            console.log('sent dm to', y.user);
            (await getUser(y.user) ?? x.author).send(y.dm);
          }
          break;
        case 'nickname':
          if (x) {
            var y = JSON.parse(cmd.arguments);
            console.log('changed', y.user + "'s nickname to", y.name);
            (await x.guild.members.fetch((y.user ? await getUser(y.user) : client.user).id))
              .setNickname(y.name);
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
    guild.members.cache.forEach(x => {
      client.users.cache.get(x);
    })
  });
  client.on('presenceUpdate', (_, x) => {
    if (!x || x?.status == _?.status || x.status != 'online' || x.guild.id != process.env.GUILD) return;
    sendmsg(x.user.username + ' (' + x.user.id + ') is ' + x.status + '! (DO NOT PING THEM but you can send a msg)',
      true, null, true, true);
  });
  client.on('messageCreate', x => {
    if ((x.channel.type == 1 || x.channel.name == chat) && !x.author.bot) {
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