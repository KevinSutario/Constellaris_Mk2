import OpenAI from "openai"
import { config } from "../../config/env.js"
import fs from "fs"

const client = new OpenAI({ apiKey: config.OPENAI_API_KEY })

function loadPrompt(path) {
  return fs.readFileSync(path, "utf-8")
}

function flattenJSON(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/[{}"]/g, "").replace(/:/g, "")
    .replace(/,\n/g, ", ").replace(/\n/g, " ")
    .replace(/\s+/g, " ").trim()
}

// Generate image for one character and save to saveDir/images/
export async function generateCharacterImage(id, saveDir) {
  const personalityPath = `${saveDir}/characters/${id}_personality.json`
  const appearancePath  = `${saveDir}/characters/${id}_appearance.json`

  if (!fs.existsSync(personalityPath) || !fs.existsSync(appearancePath)) {
    console.log(`Missing data for ${id} in ${saveDir}`)
    return
  }

  const personality = JSON.parse(fs.readFileSync(personalityPath, "utf-8"))
  const appearance  = JSON.parse(fs.readFileSync(appearancePath,  "utf-8"))

  const stylePrompt    = loadPrompt("prompts/character/character_global_art_style_prompt.txt")
  const appearanceText = flattenJSON(appearance)
  const personalityText = flattenJSON(personality)

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
`

  console.log(`Generating image for ${id} in ${saveDir}...`)

  const result = await client.images.generate({
    model:      "gpt-image-1",
    prompt:     finalPrompt,
    size:       "1024x1024",
    background: "transparent"
  })

  const imageBuffer = Buffer.from(result.data[0].b64_json, "base64")
  const imagesDir   = `${saveDir}/images`

  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })

  const outputPath = `${imagesDir}/${id}_image.png`
  fs.writeFileSync(outputPath, imageBuffer)
  console.log(`Saved ${id}_image.png → ${saveDir}`)
}

// Generate all character images for a save
export async function generateAllCharacterImages(saveDir, count = 5) {
  for (let i = 1; i <= count; i++) {
    const id = `C${String(i).padStart(3, "0")}`
    await generateCharacterImage(id, saveDir)
  }
}