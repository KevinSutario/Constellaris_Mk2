import fs from "fs"
import path from "path"
import { validate } from "./validator.js"
import { updateMemory } from "./update_memory.js"
import { config } from "../../config/env.js"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY)

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
})

async function generateScene(prompt) {
  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    return text.trim()
  } catch (err) {
    console.error("Gemini error:", err)
    return null
  }
}

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

function loadJSON(pathStr) {
  return JSON.parse(fs.readFileSync(pathStr, 'utf-8'))
}

function loadText(pathStr) {
  return fs.readFileSync(pathStr, 'utf-8')
}

function saveJSON(pathStr, data) {
  fs.writeFileSync(pathStr, JSON.stringify(data, null, 2))
}

function loadCharacters() {
  const charDir = `${BASE_PATH}/data/characters`
  const files = fs.readdirSync(charDir)

  const characters = {}

  files.forEach(file => {
    const fullPath = path.join(charDir, file)

    if (file.endsWith('_personality.json')) {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
      const id = data.id

      if (!characters[id]) characters[id] = {}
      characters[id].personality = data
    }
  })

  return characters
}

function loadMemory() {
  const memoryPath = `${BASE_PATH}/data/story/story_memory.json`
  return JSON.parse(fs.readFileSync(memoryPath, 'utf-8'))
}

function getScenarioPath(iteration) {
  return `${BASE_PATH}/prompts/story/scenario${iteration}_prompt.txt`
}

function appendStory(logPath, scene, iteration, phase) {
  const entry = `\n[Iteration ${iteration} | ${phase}]\n${scene}\n`
  fs.appendFileSync(logPath, entry)
}

function formatCharactersForPrompt(characters, state) {
  let output = ""

  Object.keys(characters).forEach(id => {
    const base = characters[id].personality
    const dynamic = state.characters?.[id] || {}

    output += `
Name: ${base.name}
Role: ${base.role}
Personality: ${base.personality.join(", ")}
Traits: ${base.traits.join(", ")}

Current State:
- Conditions: ${(dynamic.conditions || []).map(c => `${c.type}:${c.value}`).join(", ") || "none"}
- Knowledge:
  - Known: ${(dynamic.knowledge?.known_facts || []).join(", ") || "none"}
  - Beliefs: ${(dynamic.knowledge?.beliefs || []).join(", ") || "none"}
  - Misconceptions: ${(dynamic.knowledge?.misconceptions || []).join(", ") || "none"}
`
  })

  return output
}

function formatRelationshipsForPrompt(state, characters) {
  let output = ""

  Object.keys(state.relationships || {}).forEach(fromID => {
    const fromName = characters[fromID]?.personality?.name

    Object.keys(state.relationships[fromID]).forEach(toID => {
      const toName = characters[toID]?.personality?.name
      const metrics = state.relationships[fromID][toID].metrics

      output += `
${fromName} → ${toName}:
- Trust: ${metrics.trust}
- Tension: ${metrics.tension}
- Fear: ${metrics.fear}
- Respect: ${metrics.respect}
`
    })
  })

  return output
}

function buildPrompt(state, scenario) {
  const isControlled = state.meta.current_iteration <= 10
  const tension = state.meta.tension_level || 0

  const characters = loadCharacters()
  const memory = loadMemory()

  const formattedCharacters = formatCharactersForPrompt(characters, state)
  const formattedRelationships = formatRelationshipsForPrompt(state, characters)

  const formattedMemory = `
Story Summary:
${memory.summary || "None"}

Key Events:
${(memory.key_events || []).join("\n") || "None"}

Character Arcs:
${Object.entries(memory.character_arcs || {})
  .map(([id, arc]) => `${id}: ${arc}`)
  .join("\n") || "None"}
`

  return `
You are part of a controlled narrative system.

PHASE: ${isControlled ? "CONTROLLED" : "FREE"}

---

STORY MEMORY:
${formattedMemory}

---

SCENARIO (ABSOLUTE TRUTH — DO NOT ADD TO IT):
${scenario}

---

CHARACTER IDENTITY (STRICT — DO NOT VIOLATE):

You are given EXACTLY 5 characters.

These are the ONLY characters that exist in this story.

You are STRICTLY FORBIDDEN from:
- creating new characters
- inventing new names
- introducing unnamed people

If you mention any person, they MUST be one of the following:

${Object.entries(characters).map(([id, c]) => `
${id}: ${c.personality.name}
Role: ${c.personality.role}
Personality: ${c.personality.personality.join(", ")}
Traits: ${c.personality.traits.join(", ")}
`).join("\n")}

---

CRITICAL RULE:

- You MUST use ONLY these names
- You MUST NOT generate names like "Mei", "Kai", "Zhang", etc.
- If you need to refer to someone, use:
  - their name
  - or pronouns (he/she)

Violation of this rule = INVALID OUTPUT

---

RELATIONSHIPS:
${formattedRelationships}

---

RULES:

${isControlled ? `
STRICT CONTROL MODE:

- You MUST follow the scenario exactly
- You are NOT allowed to add events
- You are ONLY allowed to describe:
  - reactions
  - dialogue
  - thoughts

FORBIDDEN:
- new characters
- new events
- explanations
- resolutions
- world expansion

You are NOT the storyteller. You are a reactor.

Focus on:
- emotional reactions
- subtle behavior
- interpersonal tension
` : `
FREE MODE:

- Continue the story naturally
- Maintain character consistency
- Use relationships and knowledge to guide behavior
`}

TENSION LEVEL: ${tension}

Behavior Guideline:

${tension <= 2 ? `
LOW TENSION:
- Keep reactions subtle
- Avoid direct confrontation
- Focus on hesitation, observation, internal thoughts
` : tension <= 5 ? `
MEDIUM TENSION:
- Allow mild disagreements
- Slightly sharper dialogue
- Some characters may challenge others
` : `
HIGH TENSION:
- Strong personality clashes allowed
- Direct confrontation
- Characters may act against each other
- Emotional intensity should be visible
`}

---

IMPORTANT:

Each character must behave according to:
- their personality
- their current emotional/physical condition
- what THEY know (not what others know)

---

Before writing:
Check:
- Did I add anything not in scenario? If yes, STOP.
- Am I making characters act out of character? If yes, STOP.
FINAL CHECK BEFORE OUTPUT:

- Did I introduce any new name not listed above? If yes, STOP.
- Did I use ONLY the provided characters? If not, STOP.

---
OUTPUT LENGTH REQUIREMENT:

- Write between 500 to 700 words
- Do NOT write too short or too long
- Maintain continuous narrative flow

Write the scene.
`
}

export async function run() {
  const statePath = `${BASE_PATH}/data/story/story_state.json`
  const logPath = `${BASE_PATH}/data/story/story_log.txt`

  const state = loadJSON(statePath)

  const iteration = state.meta.current_iteration
  const scenarioPath = getScenarioPath(iteration)

  const scenario = loadText(scenarioPath)

  const characters = loadCharacters()

  let attempt = 0

  while (attempt < 3) {
    const prompt = buildPrompt(state, scenario)

    const scene = await generateScene(prompt)

    if (!scene) {
      attempt++
      console.log("Retry: generateScene returned null")
      continue
    }

    const result = validate(scene, state, characters)

    if (result.valid) {
      // Update state BEFORE writing memory so they stay in sync
      state.meta.current_iteration += 1

      if (state.meta.current_iteration > 10) {
        state.meta.phase = "free"
      }

      // Save state first
      saveJSON(statePath, state)

      // Then append log and update memory
      appendStory(logPath, scene, iteration, state.meta.phase)
      updateMemory(scene, characters)

      return scene
    }

    attempt++
    console.log("Retry due to:", result.violations)
  }

  throw new Error("Failed after retries")
}