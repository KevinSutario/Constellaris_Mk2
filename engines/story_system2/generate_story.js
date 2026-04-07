import fs from "fs"
import path from "path"
import { validate } from "./validator.js"
import { updateMemory } from "./update_memory.js"
import { config } from "../../config/env.js"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY })

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

// ─── Token maps ────────────────────────────────────────────────────────────────
// Builds two maps:
//   nameToToken: { "Park Jisoo": "CHARACTER_001", ... }
//   tokenToName: { "CHARACTER_001": "Park Jisoo", ... }
// Character IDs are already "C001", "C002" etc — we use the same numbering.

function buildTokenMaps(characters) {
  const nameToToken = {}
  const tokenToName = {}

  Object.keys(characters).forEach(id => {
    const name = characters[id].personality?.name
    if (!name) return

    // Convert "C001" → "CHARACTER_001", "C002" → "CHARACTER_002", etc.
    const num = id.replace(/\D/g, "").padStart(3, "0")
    const token = `CHARACTER_${num}`

    nameToToken[name] = token
    tokenToName[token] = name
  })

  return { nameToToken, tokenToName }
}

// Replace all real names in a string with their tokens.
// Sorts by length descending so "Park Jisoo" is replaced before "Jisoo".
function applyTokens(text, nameToToken) {
  let result = text
  const sortedNames = Object.keys(nameToToken).sort((a, b) => b.length - a.length)
  sortedNames.forEach(name => {
    result = result.replaceAll(name, nameToToken[name])
  })
  return result
}

// Replace all tokens in AI output back to real names.
function restoreNames(text, tokenToName) {
  let result = text
  Object.keys(tokenToName).forEach(token => {
    result = result.replaceAll(token, tokenToName[token])
  })
  return result
}

// ─── Prompt builders ───────────────────────────────────────────────────────────

function formatCharactersForPrompt(characters, state, nameToToken) {
  let output = ""

  Object.keys(characters).forEach(id => {
    const base = characters[id].personality
    const dynamic = state.characters?.[id] || {}
    const token = nameToToken[base.name]

    output += `
Token: ${token}
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

function formatRelationshipsForPrompt(state, characters, nameToToken) {
  let output = ""

  Object.keys(state.relationships || {}).forEach(fromID => {
    const fromName = characters[fromID]?.personality?.name
    const fromToken = nameToToken[fromName] || fromName

    Object.keys(state.relationships[fromID]).forEach(toID => {
      const toName = characters[toID]?.personality?.name
      const toToken = nameToToken[toName] || toName
      const metrics = state.relationships[fromID][toID].metrics

      output += `
${fromToken} → ${toToken}:
- Trust: ${metrics.trust}
- Tension: ${metrics.tension}
- Fear: ${metrics.fear}
- Respect: ${metrics.respect}
`
    })
  })

  return output
}

function buildSystemPrompt(characters, nameToToken) {
  const tokenList = Object.keys(nameToToken)
    .map(name => `- ${nameToToken[name]}`)
    .join("\n")

  return `You are a narrative engine for a controlled story system.

You will write scenes using character tokens instead of real names.
The ONLY valid character tokens are:
${tokenList}

Rules:
- Use ONLY these tokens to refer to characters. Never use real names.
- Do not invent new tokens or names of any kind.
- Tokens are case-sensitive. Always write them in ALL_CAPS exactly as shown.
- You may use pronouns (he/she/they) after establishing the token.

The tokens will be replaced with real names after you output the scene.`
}

function buildPrompt(state, scenario, characters, nameToToken) {
  const isControlled = state.meta.current_iteration <= 10
  const tension = state.meta.tension_level || 0

  const memory = loadMemory()

  // Tokenise memory and scenario so no real names leak into the prompt
  const tokenisedScenario = applyTokens(scenario, nameToToken)
  const tokenisedSummary = applyTokens(memory.summary || "None", nameToToken)
  const tokenisedEvents = (memory.key_events || [])
    .map(e => applyTokens(e, nameToToken))
    .join("\n") || "None"
  const tokenisedArcs = Object.entries(memory.character_arcs || {})
    .map(([id, arc]) => `${id}: ${applyTokens(arc, nameToToken)}`)
    .join("\n") || "None"

  const formattedCharacters = formatCharactersForPrompt(characters, state, nameToToken)
  const formattedRelationships = formatRelationshipsForPrompt(state, characters, nameToToken)

  return `
You are part of a controlled narrative system.

PHASE: ${isControlled ? "CONTROLLED" : "FREE"}

---

STORY MEMORY:
Story Summary:
${tokenisedSummary}

Key Events:
${tokenisedEvents}

Character Arcs:
${tokenisedArcs}

---

SCENARIO (ABSOLUTE TRUTH — DO NOT ADD TO IT):
${tokenisedScenario}

---

CHARACTERS:
${formattedCharacters}

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

OUTPUT LENGTH REQUIREMENT:

- Write between 500 to 700 words
- Do NOT write too short or too long
- Maintain continuous narrative flow

Write the scene using CHARACTER tokens only.
`
}

// ─── Generation ────────────────────────────────────────────────────────────────

async function generateScene(systemPrompt, userPrompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 7500
    })

    return response.choices[0].message.content.trim()
  } catch (err) {
    console.error("OpenAI error:", err)
    return null
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export async function run() {
  const statePath = `${BASE_PATH}/data/story/story_state.json`
  const logPath = `${BASE_PATH}/data/story/story_log.txt`

  const state = loadJSON(statePath)

  const iteration = state.meta.current_iteration
  const scenarioPath = getScenarioPath(iteration)
  const scenario = loadText(scenarioPath)

  const characters = loadCharacters()
  const { nameToToken, tokenToName } = buildTokenMaps(characters)

  const systemPrompt = buildSystemPrompt(characters, nameToToken)

  let attempt = 0

  while (attempt < 3) {
    const userPrompt = buildPrompt(state, scenario, characters, nameToToken)

    // AI writes scene with tokens
    const rawScene = await generateScene(systemPrompt, userPrompt)

    if (!rawScene) {
      attempt++
      console.log("Retry: generateScene returned null")
      continue
    }

    // Validate the tokenised output — check for unknown tokens / forbidden phrases
    const result = validate(rawScene, tokenToName)

    if (result.valid) {
      // Restore real names before saving / displaying
      const scene = restoreNames(rawScene, tokenToName)

      state.meta.current_iteration += 1
      if (state.meta.current_iteration > 10) {
        state.meta.phase = "free"
      }

      saveJSON(statePath, state)
      appendStory(logPath, scene, iteration, state.meta.phase)
      updateMemory(scene, characters)

      return scene
    }

    attempt++
    console.log("Retry due to:", result.violations)
  }

  throw new Error("Failed after retries")
}