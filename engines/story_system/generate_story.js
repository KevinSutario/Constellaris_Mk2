import fs from "fs"
import path from "path"
import { validate }      from "./validator.js"
import { updateMemory }  from "./update_memory.js"
import { parseSlides }   from "./parse_slides.js"
import { config }        from "../../config/env.js"
import OpenAI            from "openai"

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY })

const ROOT = "C:/Users/sutar/Documents/Constellaris_Mk2"

// ─── FILE HELPERS ─────────────────────────────────────────────────────────────
function loadJSON(p)       { return JSON.parse(fs.readFileSync(p, "utf-8")) }
function loadText(p)       { return fs.readFileSync(p, "utf-8") }
function saveJSON(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2)) }

function loadCharacters(saveDir) {
  const charDir    = `${saveDir}/characters`
  const characters = {}
  fs.readdirSync(charDir).forEach(file => {
    if (!file.endsWith("_personality.json")) return
    const data = JSON.parse(fs.readFileSync(path.join(charDir, file), "utf-8"))
    const id   = data.id
    if (!characters[id]) characters[id] = {}
    characters[id].personality = data
  })
  return characters
}

function loadMemory(saveDir) {
  return JSON.parse(fs.readFileSync(`${saveDir}/story/story_memory.json`, "utf-8"))
}

// Scenario prompts are shared — stored in project root prompts folder
function getScenarioPath(iteration) {
  return `${ROOT}/prompts/story/scenario${iteration}_prompt.txt`
}

function appendStory(logPath, scene, iteration, phase) {
  fs.appendFileSync(logPath, `\n[Iteration ${iteration} | ${phase}]\n${scene}\n`)
}

// ─── TOKEN MAPS ───────────────────────────────────────────────────────────────
function buildTokenMaps(characters) {
  const nameToToken = {}
  const tokenToName = {}
  Object.keys(characters).forEach(id => {
    const name = characters[id].personality?.name
    if (!name) return
    const num   = id.replace(/\D/g, "").padStart(3, "0")
    const token = `CHARACTER_${num}`
    nameToToken[name]  = token
    tokenToName[token] = name
  })
  return { nameToToken, tokenToName }
}

function applyTokens(text, nameToToken) {
  let result = text
  Object.keys(nameToToken).sort((a, b) => b.length - a.length)
    .forEach(name => { result = result.replaceAll(name, nameToToken[name]) })
  return result
}

function restoreNames(text, tokenToName) {
  let result = text
  Object.keys(tokenToName).forEach(token => { result = result.replaceAll(token, tokenToName[token]) })
  return result
}

// ─── PROMPT BUILDERS ──────────────────────────────────────────────────────────
function formatCharactersForPrompt(characters, state, nameToToken) {
  let output = ""
  Object.keys(characters).forEach(id => {
    const base    = characters[id].personality
    const dynamic = state.characters?.[id] || {}
    const token   = nameToToken[base.name]
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
    const fromToken = nameToToken[characters[fromID]?.personality?.name] || fromID
    Object.keys(state.relationships[fromID]).forEach(toID => {
      const toToken = nameToToken[characters[toID]?.personality?.name] || toID
      const m = state.relationships[fromID][toID].metrics
      output += `\n${fromToken} → ${toToken}:\n- Trust: ${m.trust}\n- Tension: ${m.tension}\n- Fear: ${m.fear}\n- Respect: ${m.respect}\n`
    })
  })
  return output
}

function buildSystemPrompt(characters, nameToToken, language) {
  const tokenList = Object.keys(nameToToken)
    .map(name => `- ${nameToToken[name]}`).join("\n")

  const langInstruction = language !== "English"
    ? `\nLANGUAGE: You MUST write the entire scene in ${language}. All dialogue, narration, and thoughts must be in ${language}.\n`
    : ""

  return `You are a narrative engine for a controlled story system.
${langInstruction}
You will write scenes using character tokens instead of real names.
The ONLY valid character tokens are:
${tokenList}

Rules:
- Use ONLY these tokens to refer to characters. Never use real names.
- Do not invent new tokens or names of any kind.
- Tokens are ALWAYS written in ALL_CAPS exactly as shown.
- You may use pronouns (he/she/they) after establishing the token.

The tokens will be replaced with real names after output.`
}

function buildPrompt(state, scenario, characters, nameToToken, language) {
  const isControlled = state.meta.current_iteration <= 10
  const tension      = state.meta.tension_level || 0
  const memory       = loadMemory(path.dirname(path.dirname(Object.keys(state)[0] || "")))

  // We pass saveDir separately so load memory via characters path trick — actually pass memory in
  // Memory is passed as parameter below in run()
  return { isControlled, tension }
}

function buildFullPrompt(state, scenario, characters, nameToToken, memory, language) {
  const isControlled = state.meta.current_iteration <= 10
  const tension      = state.meta.tension_level || 0

  const tokenisedScenario = applyTokens(scenario, nameToToken)
  const tokenisedSummary  = applyTokens(memory.summary || "None", nameToToken)
  const tokenisedEvents   = (memory.key_events || []).map(e => applyTokens(e, nameToToken)).join("\n") || "None"
  const tokenisedArcs     = Object.entries(memory.character_arcs || {})
    .map(([id, arc]) => `${id}: ${applyTokens(arc, nameToToken)}`).join("\n") || "None"

  const formattedChars  = formatCharactersForPrompt(characters, state, nameToToken)
  const formattedRels   = formatRelationshipsForPrompt(state, characters, nameToToken)

  const langNote = language !== "English"
    ? `\nLANGUAGE REQUIREMENT: Write the entire scene in ${language}. Every word of output must be in ${language}.\n`
    : ""

  return `
You are part of a controlled narrative system.
${langNote}
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
${formattedChars}

---

RELATIONSHIPS:
${formattedRels}

---

RULES:
${isControlled ? `
STRICT CONTROL MODE:
- Follow the scenario exactly
- Only describe: reactions, dialogue, thoughts
- FORBIDDEN: new characters, new events, explanations, resolutions, world expansion
- You are a REACTOR not a storyteller
- Focus: emotional reactions, subtle behavior, interpersonal tension
` : `
FREE MODE:
- Continue the story naturally
- Maintain character consistency
- Use relationships and knowledge to guide behavior
`}

TENSION LEVEL: ${tension}
${tension <= 2 ? "LOW TENSION: subtle reactions, no confrontation, hesitation and observation" :
  tension <= 5 ? "MEDIUM TENSION: mild disagreements, slightly sharper dialogue" :
                 "HIGH TENSION: strong personality clashes, direct confrontation, emotional intensity"}

---

Each character must behave according to their personality, current conditions, and what THEY personally know.

OUTPUT LENGTH: Write between 500 to 700 words. Maintain continuous narrative flow.

Write the scene.
`
}

// ─── API CALL ─────────────────────────────────────────────────────────────────
async function generateScene(systemPrompt, userPrompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   }
      ],
      max_tokens: 2500
    })
    return response.choices[0].message.content.trim()
  } catch (err) {
    console.error("OpenAI error:", err)
    return null
  }
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
// saveDir:  full path e.g. C:/.../data/saves/save_123
// language: "English" | "Indonesian" | "Chinese" | "Cantonese"
export async function run(saveDir, language = "English") {
  const statePath = `${saveDir}/story/story_state.json`
  const logPath   = `${saveDir}/story/story_log.txt`

  const state      = loadJSON(statePath)
  const iteration  = state.meta.current_iteration
  const characters = loadCharacters(saveDir)
  const memory     = loadMemory(saveDir)

  const scenarioPath = getScenarioPath(iteration)
  if (!fs.existsSync(scenarioPath)) {
    throw new Error(`Scenario file not found: ${scenarioPath}`)
  }
  const scenario = loadText(scenarioPath)

  const { nameToToken, tokenToName } = buildTokenMaps(characters)
  const systemPrompt = buildSystemPrompt(characters, nameToToken, language)

  let attempt = 0
  while (attempt < 3) {
    const userPrompt = buildFullPrompt(state, scenario, characters, nameToToken, memory, language)
    const rawScene   = await generateScene(systemPrompt, userPrompt)

    if (!rawScene) { attempt++; console.log("Retry: null response"); continue }

    const result = validate(rawScene, tokenToName)

    if (result.valid) {
      const scene = restoreNames(rawScene, tokenToName)

      // Update state
      state.meta.current_iteration += 1
      if (state.meta.current_iteration > 10) state.meta.phase = "free"
      saveJSON(statePath, state)

      // Log + memory + slides
      appendStory(logPath, scene, iteration, state.meta.phase)
      updateMemory(scene, characters, saveDir)
      await parseSlides(scene, characters, saveDir, language)

      return scene
    }

    attempt++
    console.log("Retry due to:", result.violations)
  }

  throw new Error("Failed to generate valid scene after 3 attempts")
}