import fs from "fs"

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

function loadJSON(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

export function updateMemory(scene) {
  const memoryPath = `${BASE_PATH}/data/story/story_memory.json`

  const memory = loadJSON(memoryPath)

  const shortEvent = scene.split(".")[0].slice(0, 120)

  if (!memory.key_events) memory.key_events = []
  memory.key_events.push(shortEvent)

  if (memory.key_events.length > 15) {
    memory.key_events.shift()
  }

  memory.summary = (memory.key_events || [])
    .map((e, i) => `(${i + 1}) ${e}`)
    .join("\n")

  saveJSON(memoryPath, memory)
}