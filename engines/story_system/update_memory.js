const fs = require('fs')

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

function loadJSON(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

function updateMemory(scene) {
  const memoryPath = `${BASE_PATH}/data/story/story_memory.json`

  const memory = loadJSON(memoryPath)

  // SIMPLE SAFE UPDATE (no hallucination risk)
  memory.key_events.push(scene.slice(0, 100))

  // keep only last 20 events
  if (memory.key_events.length > 20) {
    memory.key_events.shift()
  }

  // update summary (very basic for now)
  memory.summary = memory.key_events.join(" ")

  saveJSON(memoryPath, memory)
}

module.exports = { updateMemory }