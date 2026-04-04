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

  const metrics = detectRelationshipChange(scene)

  const hasSignal = Object.values(metrics).some(v => v !== 0)

  if (!hasSignal) return updates

  names.forEach(nameA => {
    names.forEach(nameB => {
      if (nameA === nameB) return

      if (scene.includes(nameA) && scene.includes(nameB)) {
        const idA = nameMap[nameA]
        const idB = nameMap[nameB]

        if (!updates[idA]) updates[idA] = {}

        updates[idA][idB] = {
          metrics,
          reason: `Detected interaction tone between ${nameA} and ${nameB}`
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

  const characters = loadCharacters()
  const nameMap = buildNameMap(characters)

  if (state.meta.phase === "controlled") {
    const relationshipUpdates = extractRelationships(scene, state, nameMap)
    applyRelationshipUpdates(state, relationshipUpdates)

    const knowledgeUpdates = extractKnowledge(scene, nameMap)
    applyKnowledgeUpdates(state, knowledgeUpdates)

    const conditionUpdates = extractConditions(scene, nameMap)
    applyConditionUpdates(state, conditionUpdates)
  }

  saveJSON(statePath, state)
}


const RELATION_KEYWORDS = {
  tension: [
    "glare",
    "cold",
    "sharp tone",
    "snapped",
    "irritated",
    "annoyed",
    "tense",
    "suspicious",
    "narrowed eyes"
  ],
  trust: [
    "reassured",
    "nodded",
    "trusted",
    "calm voice",
    "softly",
    "agreed",
    "cooperated"
  ],
  fear: [
    "afraid",
    "fear",
    "hesitated",
    "stepped back",
    "trembled",
    "uneasy",
    "nervous"
  ],
  respect: [
    "acknowledged",
    "admired",
    "impressed",
    "recognized",
    "respected"
  ]
}

const KNOWLEDGE_KEYWORDS = {
  known: [
    "realized",
    "understood",
    "noticed",
    "recognized",
    "confirmed"
  ],
  belief: [
    "thought",
    "assumed",
    "believed",
    "suspected"
  ],
  misconception: [
    "mistook",
    "wrongly",
    "misunderstood"
  ]
}

const CONDITION_KEYWORDS = {
  physical: {
    injured: ["injured", "hurt", "wounded", "bleeding"],
    healed: ["healed", "recovered", "no longer hurt"],
    exhausted: ["tired", "exhausted", "fatigued"]
  },
  emotional: {
    tense: ["tense", "on edge", "stiff"],
    calm: ["calm", "relaxed", "steady"],
    fearful: ["afraid", "scared", "fearful", "nervous"]
  },
  mental: {
    focused: ["focused", "sharp", "clear-headed"],
    unstable: ["unstable", "panicking", "losing control"],
    overwhelmed: ["overwhelmed", "shaken"]
  }
}

function extractConditions(scene, nameMap) {
  const updates = {}

  const sceneLower = scene.toLowerCase()

  Object.keys(nameMap).forEach(name => {
    if (!scene.includes(name)) return

    const id = nameMap[name]

    Object.keys(CONDITION_KEYWORDS).forEach(type => {
      Object.keys(CONDITION_KEYWORDS[type]).forEach(condition => {
        CONDITION_KEYWORDS[type][condition].forEach(keyword => {
          if (sceneLower.includes(keyword)) {
            if (!updates[id]) updates[id] = []

            updates[id].push({
              type,
              value: condition
            })
          }
        })
      })
    })
  })

  return updates
}

function applyConditionUpdates(state, updates) {
  Object.keys(updates).forEach(id => {
    if (!state.characters[id]) {
      state.characters[id] = {
        knowledge: {
          known_facts: [],
          beliefs: [],
          misconceptions: []
        },
        conditions: [],
        location: ""
      }
    }

    updates[id].forEach(newCondition => {
      const existing = state.characters[id].conditions || []

      // remove same type
      const filtered = existing.filter(c => c.type !== newCondition.type)

      filtered.push(newCondition)

      state.characters[id].conditions = filtered
    })
  })
}

function detectRelationshipChange(scene) {
  const sceneLower = scene.toLowerCase()

  const result = {
    trust: 0,
    tension: 0,
    dependency: 0,
    fear: 0,
    respect: 0
  }

  Object.keys(RELATION_KEYWORDS).forEach(metric => {
    RELATION_KEYWORDS[metric].forEach(keyword => {
      if (sceneLower.includes(keyword)) {
        result[metric] += 1
      }
    })
  })

  return result
}

function extractKnowledge(scene, nameMap) {
  const updates = {}

  const sceneLower = scene.toLowerCase()

  Object.keys(nameMap).forEach(name => {
    const id = nameMap[name]

    if (!scene.includes(name)) return

    if (!updates[id]) {
      updates[id] = {
        known_facts: [],
        beliefs: [],
        misconceptions: []
      }
    }

    KNOWLEDGE_KEYWORDS.known.forEach(word => {
      if (sceneLower.includes(word)) {
        updates[id].known_facts.push(`Detected: ${word}`)
      }
    })

    KNOWLEDGE_KEYWORDS.belief.forEach(word => {
      if (sceneLower.includes(word)) {
        updates[id].beliefs.push(`Detected: ${word}`)
      }
    })

    KNOWLEDGE_KEYWORDS.misconception.forEach(word => {
      if (sceneLower.includes(word)) {
        updates[id].misconceptions.push(`Detected: ${word}`)
      }
    })
  })

  return updates
}
function applyKnowledgeUpdates(state, updates) {
  Object.keys(updates).forEach(id => {
    if (!state.characters[id]) {
      state.characters[id] = {
        knowledge: {
          known_facts: [],
          beliefs: [],
          misconceptions: []
        },
        conditions: [],
        location: ""
      }
    }

    const charKnowledge = state.characters[id].knowledge

    charKnowledge.known_facts.push(...updates[id].known_facts)
    charKnowledge.beliefs.push(...updates[id].beliefs)
    charKnowledge.misconceptions.push(...updates[id].misconceptions)
  })
}

module.exports = { run }