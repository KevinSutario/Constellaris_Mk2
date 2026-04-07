import fs from "fs"

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

function loadJSON(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

// Detect a brief arc note for a character based on keywords found near their name
function extractArcNote(scene, name) {
  const sentences = scene.split(/(?<=[.!?])\s+/)
  const relevant = sentences.filter(s => s.includes(name))
  if (relevant.length === 0) return null

  // Return the first relevant sentence, trimmed to 100 chars
  return relevant[0].slice(0, 100).trim()
}

export function updateMemory(scene, characters) {
  const memoryPath = `${BASE_PATH}/data/story/story_memory.json`

  const memory = loadJSON(memoryPath)

  // Update key events
  const shortEvent = scene.split(".")[0].slice(0, 120)

  if (!memory.key_events) memory.key_events = []
  memory.key_events.push(shortEvent)

  if (memory.key_events.length > 15) {
    memory.key_events.shift()
  }

  memory.summary = (memory.key_events || [])
    .map((e, i) => `(${i + 1}) ${e}`)
    .join("\n")

  // Update character arcs if characters are provided
  if (characters) {
    if (!memory.character_arcs) memory.character_arcs = {}

    Object.values(characters).forEach(c => {
      const name = c.personality?.name
      const id = c.personality?.id
      if (!name || !id) return

      const note = extractArcNote(scene, name)
      if (note) {
        memory.character_arcs[id] = note
      }
    })
  }

  saveJSON(memoryPath, memory)
}