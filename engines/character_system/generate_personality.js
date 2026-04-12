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

// Generate one personality — pure API call, no file ops
export async function generatePersonality(gender) {
  const basePrompt = loadPrompt("prompts/character/Personality_Prompt.txt")

  const prompt = `
${basePrompt}

Character constraints:
- Gender must be "${gender}"
- You MUST include a "name" field
- The name must be realistic and consistent with the character background
- The name must be unique among characters
- Do NOT leave name empty
- Name must be Korean Manhwa Style
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

// Save one character to a specific save directory
export function saveCharacter(personality, index, saveDir) {
  const id       = `C${String(index).padStart(3, "0")}`
  const charDir  = `${saveDir}/characters`
  const filename = `${charDir}/${id}_personality.json`

  if (!fs.existsSync(charDir)) fs.mkdirSync(charDir, { recursive: true })

  const fullData = { id, ...personality }
  fs.writeFileSync(filename, JSON.stringify(fullData, null, 2))
  console.log(`Saved ${id}_personality.json → ${saveDir}`)
  return fullData
}

// Generate all 5 characters and save to saveDir
export async function createCharactersForSave(saveDir) {
  const genders = ["female", "female", "female", "male", "male"]
  const results = []

  for (let i = 0; i < genders.length; i++) {
    const index  = i + 1
    const gender = genders[i]
    console.log(`\nGenerating character ${index} (${gender})...`)

    const personality = await generatePersonality(gender)
    if (!personality) { console.log("Skipping due to parse error"); continue }

    const saved = saveCharacter(personality, index, saveDir)
    results.push(saved)
  }

  return results
}