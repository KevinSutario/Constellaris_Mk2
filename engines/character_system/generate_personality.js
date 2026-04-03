import OpenAI from "openai";
import { config } from "../config/env.js";
import fs from "fs";

const client = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});


// 🧱 Load prompt from file
function loadPrompt(path) {
  return fs.readFileSync(path, "utf-8");
}


// 🛡️ Safe JSON parse
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


// 🎯 ACTION: generate personality
export async function generatePersonality() {
  const prompt = loadPrompt("prompts/character/Personality_Prompt.txt");

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You output strict JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0].message.content;

  return safeParse(text);
}


// 💾 ACTION: save one character
function saveCharacter(character, index) {
  const id = `C${String(index).padStart(3, "0")}`;

  const fullCharacter = {
    id,
    ...character,
  };

  fs.writeFileSync(
    `data/characters/${id}.json`,
    JSON.stringify(fullCharacter, null, 2)
  );

  console.log(`Saved ${id}`);
}


// 🔁 ACTION: create multiple characters
export async function createMultipleCharacters(count = 3) {
  for (let i = 1; i <= count; i++) {
    console.log(`\nGenerating character ${i}...`);

    const character = await generatePersonality();

    if (!character) {
      console.log("Skipping due to parse error...");
      continue;
    }

    saveCharacter(character, i);
  }
}