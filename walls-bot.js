import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys"
import { GoogleGenerativeAI } from "@google/generative-ai"
import pino from "pino"
import http from "http"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
let qrCodeData = null;
let connected = false;

const BAD_WORDS = ["andhovakto", "choti chata", "balish chata", "khanki", "bainchod"];

async function isBadWithAI(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Is this Bengali/Hinglish message abusive, sexual harassment or slang? Message: "${text}". Reply only YES or NO.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim().toUpperCase().includes("YES");
  } catch { return false; }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if(qr){ qrCodeData = qr; console.log("New QR Generated"); }
    if(connection === 'close') {
        connected = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        if(shouldReconnect) start();
    } else if(connection === 'open') {
        connected = true; qrCodeData = null;
        console.log("NDP Guard Active - Connected!");
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
      if (!text) continue;
      const lower = text.toLowerCase();
      const hasBadWord = BAD_WORDS.some(w => lower.includes(w));
      let shouldDelete = hasBadWord;
      if(!hasBadWord) shouldDelete = await isBadWithAI(text);

      if (shouldDelete) {
        try {
            await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
            console.log(`Deleted: ${text} | From: ${msg.key.participant}`);
        } catch(e){ console.log('Delete failed - Is bot ADMIN? ', e.message); }
      }
    }
  });
}

start();

// YOUR LAST PART - THIS IS REQUIRED FOR RENDER + QR
http.createServer((req,res)=>{
    if(connected){
        res.end(`<html><body style="text-align:center;font-family:sans-serif"><h1>✅ NDP Guard Active</h1><h2>7003197209</h2></body></html>`);
    } else if(qrCodeData){
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrCodeData)}`;
        res.end(`<html><body style="text-align:center"><h2>Scan with 7003197209 Business</h2><p>Linked Devices > Link Device > Scan</p><img src="${qrUrl}" style="width:300px"/><script>setTimeout(()=>location.reload(),10000)</script></body></html>`);
    } else {
        res.end(`<h2>Starting bot... Wait 5 sec</h2><script>setTimeout(()=>location.reload(),3000)</script>`);
    }
}).listen(process.env.PORT||3000);
