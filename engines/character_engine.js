import OpenAI from "openai";
import { config } from "../config/env.js";
import fs from "fs";

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
  const prompt = `
Generate a character for a fantasy Hong Kong story for children aged 9-18.

Return ONLY valid JSON. Do not include markdown or backticks.

Format:
{
  "name": "",
  "age": number,
  "personality": [],
  "traits": [],
  "role": ""
}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You output strict JSON only." },
      { role: "user", content: prompt },
    ],
  });

  let text = response.choices[0].message.content;

  // ✅ USE SAFE PARSE HERE
  return safeParse(text);
}


// (no change here)
export async function createCharacter() {
  const personality = await generatePersonality();

  if (!personality) {
    throw new Error("Character generation failed.");
  }

  const character = {
    id: `C${Date.now()}`,
    ...personality,
  };

  fs.writeFileSync(
    `data/characters/${character.id}.json`,
    JSON.stringify(character, null, 2)
  );

  return character;
}