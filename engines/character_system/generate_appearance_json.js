import OpenAI from "openai"
import { config } from "../../config/env.js"
import fs from "fs"

const client = new OpenAI({ apiKey: config.OPENAI_API_KEY })

function loadPrompt(path) {
  return fs.readFileSync(path, "utf-8")
}

function safeParse(text) {
  try {
    return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim())
  } catch (err) {
    console.error("Parsing failed:", text)
    return null
  }
}

// Generate appearance JSON for one character — pure API call
export async function generateAppearance(characterData) {
  const promptTemplate = loadPrompt("prompts/character/appearance_prompt.txt")

  const prompt = `
${promptTemplate}

Character:
${JSON.stringify(characterData, null, 2)}
`

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You output strict JSON only." },
      { role: "user",   content: prompt }
    ]
  })

  return safeParse(response.choices[0].message.content)
}

// Save appearance to a specific save directory
export function saveAppearance(appearance, id, saveDir) {
  const charDir  = `${saveDir}/characters`
  const filename = `${charDir}/${id}_appearance.json`

  if (!fs.existsSync(charDir)) fs.mkdirSync(charDir, { recursive: true })

  fs.writeFileSync(filename, JSON.stringify(appearance, null, 2))
  console.log(`Saved ${id}_appearance.json → ${saveDir}`)
}

// Generate appearances for all characters in a save
export async function generateAllAppearances(saveDir, count = 5) {
  for (let i = 1; i <= count; i++) {
    const id   = `C${String(i).padStart(3, "0")}`
    const path = `${saveDir}/characters/${id}_personality.json`

    if (!fs.existsSync(path)) {
      console.log(`Skipping ${id} (no personality file)`)
      continue
    }

    console.log(`\nGenerating appearance for ${id}...`)
    const characterData = JSON.parse(fs.readFileSync(path, "utf-8"))
    const appearance    = await generateAppearance(characterData)

    if (!appearance) { console.log("Skipping due to parse error"); continue }

    saveAppearance(appearance, id, saveDir)
  }
}