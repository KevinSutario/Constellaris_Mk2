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

// 🔧 flatten JSON into readable prompt (important for image models)
function flattenJSON(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/[{}"]/g, "")
    .replace(/:/g, "")
    .replace(/,\n/g, ", ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  // 🔥 Flatten for better image understanding
  const appearanceText = flattenJSON(appearance);
  const personalityText = flattenJSON(personality);

  // 🧠 Build final prompt (structured, clean, controlled)
  const finalPrompt = `
${stylePrompt}

Character appearance:
${appearanceText}

Character personality context:
${personalityText}

Strict Requirements:
- Follow appearance EXACTLY as described
- Do NOT override facial structure, eyes, or skin tone
- Eyes must be sharp, high contrast, and detailed
- Skin must match described tone and undertone
- Maintain consistent anime/manhwa style
- Character must be centered
- Single character only
- No background or fully transparent background
`;

  console.log(`Generating image for ${id}...`);

  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt: finalPrompt,
    size: "1024x1024",
    background: "transparent",
  });

  const image_base64 = result.data[0].b64_json;
  const imageBuffer = Buffer.from(image_base64, "base64");

  const outputPath = `outputs/images/${id}_image.png`;

  fs.writeFileSync(outputPath, imageBuffer);

  console.log(`Saved ${id}_image.png`);
}

// 🔁 generate all
export async function generateAllCharacterImages(count = 5) {
  for (let i = 1; i <= 0; i++) {
    const id = `C${String(i).padStart(3, "0")}`;
    await generateCharacterImage(id);
  }
}