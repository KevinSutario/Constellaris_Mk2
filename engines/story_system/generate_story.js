const path = require('path')

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

const fs = require('fs')
const { validate } = require('./validator')

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

function loadJSON(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

function loadText(path) {
  return fs.readFileSync(path, 'utf-8')
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

function getScenarioPath(iteration) {
  return `${BASE_PATH}/prompts/story/scenario${iteration}_prompt.txt`
}

function appendStory(logPath, scene, iteration, phase) {
  const entry = `\n[Iteration ${iteration} | ${phase}]\n${scene}\n`
  fs.appendFileSync(logPath, entry)
}
function buildPrompt(state, scenario) {
  const isControlled = state.meta.current_iteration <= 10

  const characters = loadCharacters()

  const formattedCharacters = formatCharactersForPrompt(characters, state)
  const formattedRelationships = formatRelationshipsForPrompt(state, characters)

  return `
You are part of a controlled narrative system.

PHASE: ${isControlled ? "CONTROLLED" : "FREE"}

---

SCENARIO (ABSOLUTE TRUTH — DO NOT ADD TO IT):
${scenario}

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

---

IMPORTANT:

Each character must behave according to:
- their personality
- their current emotional/physical condition
- what THEY know (not what others know)

Characters may:
- misunderstand
- hesitate
- react differently to the same situation

---

Before writing:
Check:
- Did I add anything not in scenario? If yes, STOP.
- Am I making characters act out of character? If yes, STOP.

---

Write the scene.
`
}

async function generateScene(prompt) {
  // TODO: replace with your API call
  return "Scene placeholder"
}
function formatCharactersForPrompt(characters, state) {
  let output = ""

  Object.keys(characters).forEach(id => {
    const base = characters[id].personality
    const dynamic = state.characters[id] || {}

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

  Object.keys(state.relationships).forEach(fromID => {
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

async function run() {
  const statePath = `${BASE_PATH}/data/story/story_state.json`
  const logPath = `${BASE_PATH}/data/story/story_log.txt`

  const state = loadJSON(statePath)

  const iteration = state.meta.current_iteration
  const scenarioPath = getScenarioPath(iteration)

  const scenario = loadText(scenarioPath)

  let attempt = 0

  while (attempt < 3) {
    const prompt = buildPrompt(state, scenario)

    const scene = await generateScene(prompt)

    const characters = loadCharacters()
    const result = validate(scene, state, characters)

    if (result.valid) {
      appendStory(logPath, scene, iteration, state.meta.phase)

      state.meta.current_iteration += 1

      if (state.meta.current_iteration > 10) {
        state.meta.phase = "free"
      }

      saveJSON(statePath, state)

      return scene
    }

    attempt++
    console.log("Retry due to:", result.violations)
  }

  throw new Error("Failed after retries")
}

module.exports = { run }