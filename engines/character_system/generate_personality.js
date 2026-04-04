import OpenAI from "openai";
import { config } from "../../config/env.js";
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
export async function generatePersonality(gender) {
  const basePrompt = loadPrompt("prompts/character/Personality_Prompt.txt");

  // 👇 inject gender into the prompt
  const prompt = `
${basePrompt}

Character constraints:
- Gender must be "${gender}"
- You MUST include a "name" field
- The name must be realistic and consistent with the character background
- The name must be unique among characters
- Do NOT leave name empty
- Name must be Korean Manhwa Style
`;


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
function saveCharacter(personality, index) {
  const id = `C${String(index).padStart(3, "0")}`;

  const filename = `data/characters/${id}_personality.json`;

  const fullData = {
    id,
    ...personality,
  };

  fs.writeFileSync(filename, JSON.stringify(fullData, null, 2));

  console.log(`Saved ${id}_personality.json`);
}


// 🔁 ACTION: create multiple characters
export async function createMultipleCharacters() {
  const genders = ["female", "female", "female", "male", "male"];

  for (let i = 0; i < genders.length; i++) {
    const index = i + 1;
    const gender = genders[i];

    console.log(`\nGenerating character ${index} (${gender})...`);

    const character = await generatePersonality(gender);

    if (!character) {
      console.log("Skipping due to parse error...");
      continue;
    }

    saveCharacter(character, index);
  }
}