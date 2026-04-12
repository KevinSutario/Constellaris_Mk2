import fs from "fs"

function loadJSON(p) { return JSON.parse(fs.readFileSync(p, "utf-8")) }
function saveJSON(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2)) }

function extractArcNote(scene, name) {
  const sentences = scene.split(/(?<=[.!?])\s+/)
  const relevant  = sentences.filter(s => s.includes(name))
  return relevant.length > 0 ? relevant[0].slice(0, 100).trim() : null
}

// saveDir: full path to save folder e.g. .../data/saves/save_123
export function updateMemory(scene, characters, saveDir) {
  const memoryPath = `${saveDir}/story/story_memory.json`
  const memory     = loadJSON(memoryPath)

  // Key events
  const shortEvent = scene.split(".")[0].slice(0, 120)
  if (!memory.key_events) memory.key_events = []
  memory.key_events.push(shortEvent)
  if (memory.key_events.length > 15) memory.key_events.shift()

  memory.summary = (memory.key_events || []).map((e, i) => `(${i+1}) ${e}`).join("\n")

  // Character arcs
  if (characters) {
    if (!memory.character_arcs) memory.character_arcs = {}
    Object.values(characters).forEach(c => {
      const name = c.personality?.name
      const id   = c.personality?.id
      if (!name || !id) return
      const note = extractArcNote(scene, name)
      if (note) memory.character_arcs[id] = note
    })
  }

  saveJSON(memoryPath, memory)
}