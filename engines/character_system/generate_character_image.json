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


// 🎯 generate image for ONE character
export async function generateCharacterImage(id) {
  const personalityPath = `data/characters/${id}_personality.json`;
  const appearancePath = `data/characters/${id}_appearance.json`;

  if (!fs.existsSync(personalityPath) || !fs.existsSync(appearancePath)) {
    console.log(`Missing data for ${id}`);
    return;
  }

  const personality = JSON.parse(fs.readFileSync(personalityPath, "utf-8"));
  const appearance = JSON.parse(fs.readFileSync(appearancePath, "utf-8"));

  const stylePrompt = loadPrompt(
    "prompts/character/character_global_art_style_prompt.txt"
  );

  // 🧠 Build final prompt
  const finalPrompt = `
${stylePrompt}

Character:
${JSON.stringify(personality, null, 2)}

Appearance:
${JSON.stringify(appearance, null, 2)}

Requirements:
- Match the personality and appearance
- Character must be centered
- No background
- Transparent background
- Single character only
`;

  console.log(`Generating image for ${id}...`);

  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt: finalPrompt,
    size: "1024x1024",
    background: "transparent"
  });

  const image_base64 = result.data[0].b64_json;
  const imageBuffer = Buffer.from(image_base64, "base64");

  const outputPath = `outputs/images/${id}_image.png`;

  fs.writeFileSync(outputPath, imageBuffer);

  console.log(`Saved ${id}_image.png`);
}


// 🔁 generate all
export async function generateAllCharacterImages(count = 5) {
  for (let i = 1; i <= count; i++) {
    const id = `C${String(i).padStart(3, "0")}`;
    await generateCharacterImage(id);
  }
}