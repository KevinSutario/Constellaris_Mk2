const fs = require('fs')

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

function loadJSON(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

function extractRelationships(scene, state) {
  const updates = {}

  const pairs = Object.keys(state.relationships)

  pairs.forEach(pair => {
    const [a, b] = pair.split('_')

    if (scene.includes(a) && scene.includes(b)) {
      updates[pair] = {
        metrics: {
          trust: 0,
          tension: 1,
          dependency: 0,
          fear: 0,
          respect: 0
        },
        reason: "Interaction detected in scene"
      }
    }
  })

  return updates
}

function applyRelationshipUpdates(state, updates) {
  Object.keys(updates).forEach(pair => {
    if (!state.relationships[pair]) return

    const update = updates[pair]

    Object.keys(update.metrics).forEach(metric => {
      state.relationships[pair].metrics[metric] += update.metrics[metric]
    })

    state.relationships[pair].history.push({
      event: update.reason,
      impact: update.metrics,
      timestamp: Date.now()
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