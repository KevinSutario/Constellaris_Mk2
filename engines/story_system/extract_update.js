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

function buildNameMap(characters) {
  const map = {}

  Object.values(characters).forEach(c => {
    if (c.personality?.name && c.personality?.id) {
      map[c.personality.name] = c.personality.id
    }
  })

  return map
}

const fs = require('fs')

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

function loadJSON(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

function extractRelationships(scene, state, nameMap) {
  const updates = {}

  const names = Object.keys(nameMap)

  names.forEach(nameA => {
    names.forEach(nameB => {
      if (nameA === nameB) return

      if (scene.includes(nameA) && scene.includes(nameB)) {
        const idA = nameMap[nameA]
        const idB = nameMap[nameB]

        if (!updates[idA]) updates[idA] = {}

        updates[idA][idB] = {
          metrics: {
            trust: 0,
            tension: 1,
            dependency: 0,
            fear: 0,
            respect: 0
          },
          reason: `${nameA} interacts with ${nameB}`
        }
      }
    })
  })

  return updates
}

function applyRelationshipUpdates(state, updates) {
  Object.keys(updates).forEach(fromID => {
    if (!state.relationships[fromID]) {
      state.relationships[fromID] = {}
    }

    Object.keys(updates[fromID]).forEach(toID => {
      if (!state.relationships[fromID][toID]) {
        state.relationships[fromID][toID] = {
          metrics: {
            trust: 0,
            tension: 0,
            dependency: 0,
            fear: 0,
            respect: 0
          },
          history: []
        }
      }

      const update = updates[fromID][toID]

      Object.keys(update.metrics).forEach(metric => {
        state.relationships[fromID][toID].metrics[metric] += update.metrics[metric]
      })

      state.relationships[fromID][toID].history.push({
        event: update.reason,
        impact: update.metrics,
        timestamp: Date.now()
      })
    })
  })
}

function run(scene) {
  const statePath = `${BASE_PATH}/data/story/story_state.json`

  const state = loadJSON(statePath)

  if (state.meta.phase === "controlled") {
    const relationshipUpdates = extractRelationships(scene, state)
    applyRelationshipUpdates(state, relationshipUpdates)
  }

  saveJSON(statePath, state)
}

module.exports = { run }