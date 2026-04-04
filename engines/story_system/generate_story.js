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

  return `
You are part of a controlled narrative system.

PHASE: ${isControlled ? "CONTROLLED" : "FREE"}

SCENARIO:
${scenario}

CHARACTERS:
${JSON.stringify(state.characters, null, 2)}

RELATIONSHIPS:
${JSON.stringify(state.relationships, null, 2)}

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

You are NOT the storyteller. You are a reactor.
` : `
FREE MODE:
- Continue naturally while staying consistent
`}

Before writing:
Check if you added anything not in the scenario. If yes, STOP.

Write the scene.
`
}

async function generateScene(prompt) {
  // TODO: replace with your API call
  return "Scene placeholder"
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