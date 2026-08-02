import { Telegraf } from "telegraf";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// Gemini AI - Key is SAFE in Render, not in code
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Your Full Bad Words List + NEW Keywords
const badWords = [
  "tmc", "trinomool", "trinamool", "bjp", "bamfront", "cpim", "congress", "suci",
  "bsdk", "bhosdk", "mc", "bc", "bkl", "chutiya", "madarchod", "behenchod",
  "scam", "naxal", "dalal", "chamcha", "chele chata", "chata",
  // NEW - Your request
  "andhbhakt", "andhbhakto", "andhovakto", "andhovokto", "andhovokt", "andhbhakts",
  "choti chata", "chotichata", "choti-chata", "choti chate",
  "balish chata", "balishchata", "balish-chata", "balisher chata", "balish chate"
];

async function isAbusive(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // 1. Direct match - Fast
  for (const w of badWords) {
    if (lower.includes(w)) return true;
  }

  // 2. AI check for variations
  try {
    const prompt = `Is this Bengali/Hindi/English political abuse? Bad examples: andhovakto, choti chata, balish chata, chamcha. Text: "${text}". Reply only YES or NO`;
    const result = await model.generateContent(prompt);
    const ans = result.response.text().trim().toUpperCase();
    if (ans.includes("YES")) return true;
  } catch (e) {
    console.log("Gemini error:", e.message);
  }
  return false;
}

bot.on("message", async (ctx) => {
  try {
    const text = ctx.message.text || ctx.message.caption || "";
    if (!text) return;
    
    // Don't delete bot's own message
    if (ctx.message.from.is_bot) return;

    if (await isAbusive(text)) {
      await ctx.deleteMessage();
      console.log("Deleted:", text);
    }
  } catch (err) {
    console.log("Delete failed - Make bot Admin!");
  }
});

app.get("/", (req, res) => res.send("DP Guard Bot is Live!"));
app.listen(process.env.PORT || 3000, () => console.log("Server live"));

bot.launch().then(() => console.log("Bot Started!"));
