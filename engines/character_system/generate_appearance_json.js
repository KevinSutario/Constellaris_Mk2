import OpenAI from "openai";
import { config } from "../../config/env.js";
import fs from "fs";

const client = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});


// load prompt
function loadPrompt(path) {
  return fs.readFileSync(path, "utf-8");
}


// safe parse
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


// 🎯 generate appearance for ONE character
export async function generateAppearance(characterData) {
  const promptTemplate = loadPrompt(
    "prompts/character/appearance_prompt.txt"
  );

  const prompt = `
${promptTemplate}

Character:
${JSON.stringify(characterData, null, 2)}
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


// 💾 save appearance
function saveAppearance(appearance, id) {
  const filename = `data/characters/${id}_appearance.json`;

  fs.writeFileSync(filename, JSON.stringify(appearance, null, 2));

  console.log(`Saved ${id}_appearance.json`);
}


// 🔁 process ALL characters one by one
export async function generateAllAppearances(count = 5) {
  for (let i = 1; i <= count; i++) {
    const id = `C${String(i).padStart(3, "0")}`;
    const path = `data/characters/${id}_personality.json`;

    if (!fs.existsSync(path)) {
      console.log(`Skipping ${id} (no personality file)`);
      continue;
    }

    console.log(`\nGenerating appearance for ${id}...`);

    const characterData = JSON.parse(fs.readFileSync(path, "utf-8"));

    const appearance = await generateAppearance(characterData);

    if (!appearance) {
      console.log("Skipping due to parse error...");
      continue;
    }

    saveAppearance(appearance, id);
  }
}