require("dotenv").config();
const djs = require("discord.js");
const { OpenAI } = require("openai");
const fs = require("fs");

const client = new djs.Client({ intents: [djs.GatewayIntentBits.Guilds] });
const ai = new OpenAI({ apiKey: process.env.AIKEY });
var msgs = [];
const chat = 'a';
const prompt = 'You are a discord bot ';
const functions = [
  // {
  //   name: "get_weather",
  //   description: "Get the current weather for a specific location.",
  //   parameters: {
  //     type: "object",
  //     properties: {
  //       location: {
  //         type: "string",
  //         description: "The city and state, e.g., San Francisco, CA.",
  //       },
  //     },
  //     required: ["location"],
  //   },
  // },
];

function load() {
  try {
    msgs = JSON.parse(fs.readFileSync('chatlog/' + chat + '.json').toString());
    console.log('Loaded messages for ', chat + '...');
  } catch (e) {
    console.error('There was an error loading messages for', chat);
    msgs = [{ role: "system", content: prompt }];
    save();
  }
}

function save() {
  fs.writeFileSync('chatlog/' + chat + '.json', JSON.stringify(msgs));
  console.log('Saved messages for ', chat + '...');
}

async function runai() {
  const res = (await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: msgs,
    functions: functions,
    function_call: "auto",
  })).choices.map(x => ({ role: x.message.role, content: x.message.role }));
  console.log('Got ai response');
  msgs.push(...res);
  return res;
}

async function sendmsg(data, run, sys) {
  msgs.push({ role: sys ? 'system' : 'user', content: data });
  console.log('Added message...');
  if (run) return await runai();
}

async function init() {
  process.on('uncaughtException', e => console.error(e))
  process.on('unhandledRejection', e => console.error(e))
  process.on('exit', save);
  client.login(process.env.TOKEN);
  client.on('ready', () => console.log('Bot ready!'))
  client.on('messageCreate', x => {
    if (x.channel.name == 'ai-bot')
      sendmsg(x.author + " Said: " + x.content, true).then(e => {
        x.channel.send({ content: e[0].content });
      })
  });
  setInterval(save, 600e3);
  load();
}

init();