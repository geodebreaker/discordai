require("dotenv").config();
const djs = require("discord.js");
const { OpenAI } = require("openai");
const fs = require("fs");

const client = new djs.Client({
  intents: [
    djs.GatewayIntentBits.Guilds, // Required for general bot presence
    djs.GatewayIntentBits.GuildMessages, // Required to listen for messages in guilds
    djs.GatewayIntentBits.MessageContent
  ]
});
const ai = new OpenAI({ apiKey: process.env.AIKEY });
var msgs = [];
const chat = 'a';
const prompt = 'You are a discord bot. Write short consise messages. You are named "aibot". ' +
  + 'Your owner / creator is ' + process.env.OWNER + '.' + //. Use emojis :mood: :hapy: :nohorror: :horror:
  ' Do not ask for further conversation or for anything else.'
  + ' If you want to post a link to an image, use !image:xyz where xyz is a link to a image';
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
    msgs = [];
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
    messages: [{ role: "system", content: prompt }].concat(msgs),
    // functions: functions,
    // function_call: "auto",
  })).choices.map(x => ({ role: x.message.role, content: x.message.content }));
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
  process.on('uncaughtException', e => console.error(e));
  process.on('unhandledRejection', e => console.error(e));
  process.on('exit', save);
  process.on('SIGINT', () => process.exit(0));
  client.login(process.env.TOKEN);
  client.on('ready', () => console.log('Bot ready!'))
  client.on('messageCreate', x => {
    if (x.channel.name == 'ai-bot' && !x.author.bot) {
      console.log('Message detected from', x.author.username);
      sendmsg(x.author.username + " (" + x.author.id + ") Said: " + x.content, true).then(e => {
        var content = e[0].content;
        // var img = content.match(/(?<=!image:).*?(?= |$)/g);
        var embeds = [];
        // if (img) {
        //   embeds.push(...img.map(x =>
        //     new djs.EmbedBuilder()
        //       .setTitle('Image:')
        //       .setImage(x)
        //       .setColor('#FF0000')
        //   ));
        //   content = content.replace(/!image:.*?(?= |$)/g, '');
        // }
        x.channel.send({ content, embeds: embeds });
      });
    }
  });
  setInterval(save, 600e3);
  load();
}

init();