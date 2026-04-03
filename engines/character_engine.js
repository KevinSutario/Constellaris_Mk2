import OpenAI from "openai";
import { config } from "../config/env.js";
import fs from "fs";

function loadPrompt(path) {
  return fs.readFileSync(path, "utf-8");
}

const client = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});


// ✅ ADD THIS FUNCTION (top of file)
function safeParse(text) {
  try {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Parsing failed:");
    console.log(text);
    return null;
  }
}


// 🔧 UPDATE THIS FUNCTION
export async function generatePersonality() {
  const prompt = loadPrompt("prompts/character/generate_personality.txt");
}