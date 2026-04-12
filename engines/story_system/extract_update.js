import fs from "fs"
import path from "path"

const ROOT = "C:/Users/sutar/Documents/Constellaris_Mk2"

function loadJSON(pathStr) {
  return JSON.parse(fs.readFileSync(pathStr, "utf-8"))
}
function saveJSON(pathStr, data) {
  fs.writeFileSync(pathStr, JSON.stringify(data, null, 2))
}

function loadCharacters(saveDir) {
  const charDir = `${saveDir}/characters`
  const files   = fs.readdirSync(charDir)
  const characters = {}

  files.forEach(file => {
    if (!file.endsWith("_personality.json")) return
    const data = JSON.parse(fs.readFileSync(path.join(charDir, file), "utf-8"))
    const id   = data.id
    if (!characters[id]) characters[id] = {}
    characters[id].personality = data
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

const RELATION_KEYWORDS = {
  tension: ["glare","cold","sharp tone","snapped","irritated","annoyed","tense","suspicious","narrowed eyes"],
  trust:   ["reassured","nodded","trusted","calm voice","softly","agreed","cooperated"],
  fear:    ["afraid","fear","hesitated","stepped back","trembled","uneasy","nervous"],
  respect: ["acknowledged","admired","impressed","recognized","respected"]
}

const KNOWLEDGE_KEYWORDS = {
  known:         ["realized","understood","noticed","recognized","confirmed"],
  belief:        ["thought","assumed","believed","suspected"],
  misconception: ["mistook","wrongly","misunderstood"]
}

const CONDITION_KEYWORDS = {
  physical:  { injured:["injured","hurt","wounded","bleeding"], healed:["healed","recovered"], exhausted:["tired","exhausted","fatigued"] },
  emotional: { tense:["tense","on edge","stiff"], calm:["calm","relaxed","steady"], fearful:["afraid","scared","fearful","nervous"] },
  mental:    { focused:["focused","sharp","clear-headed"], unstable:["unstable","panicking"], overwhelmed:["overwhelmed","shaken"] }
}

function detectRelationshipChange(scene) {
  const s = scene.toLowerCase()
  const result = { trust:0, tension:0, dependency:0, fear:0, respect:0 }
  Object.keys(RELATION_KEYWORDS).forEach(metric => {
    RELATION_KEYWORDS[metric].forEach(kw => { if (s.includes(kw)) result[metric]++ })
  })
  return result
}

function extractRelationships(scene, state, nameMap) {
  const updates = {}
  const names   = Object.keys(nameMap)
  const metrics = detectRelationshipChange(scene)
  if (!Object.values(metrics).some(v => v !== 0)) return updates

  names.forEach(nameA => names.forEach(nameB => {
    if (nameA === nameB) return
    if (!scene.includes(nameA) || !scene.includes(nameB)) return
    const idA = nameMap[nameA]
    const idB = nameMap[nameB]
    if (!updates[idA]) updates[idA] = {}
    updates[idA][idB] = { metrics, reason: `Interaction between ${nameA} and ${nameB}` }
  }))

  return updates
}

function applyRelationshipUpdates(state, updates) {
  Object.keys(updates).forEach(fromID => {
    if (!state.relationships[fromID]) state.relationships[fromID] = {}
    Object.keys(updates[fromID]).forEach(toID => {
      if (!state.relationships[fromID][toID]) {
        state.relationships[fromID][toID] = { metrics:{trust:0,tension:0,dependency:0,fear:0,respect:0}, history:[] }
      }
      const u = updates[fromID][toID]
      Object.keys(u.metrics).forEach(m => { state.relationships[fromID][toID].metrics[m] += u.metrics[m] })
      state.relationships[fromID][toID].history.push({ event:u.reason, impact:u.metrics, timestamp:Date.now() })
    })
  })
}

function updateGlobalTension(state, updates) {
  let inc = 0
  Object.values(updates).forEach(t => Object.values(t).forEach(u => { inc += u.metrics.tension || 0 }))
  state.meta.tension_level = Math.min((state.meta.tension_level || 0) + inc, 10)
}

function extractKnowledge(scene, nameMap) {
  const updates = {}
  const s = scene.toLowerCase()
  Object.keys(nameMap).forEach(name => {
    if (!scene.includes(name)) return
    const id = nameMap[name]
    if (!updates[id]) updates[id] = { known_facts:[], beliefs:[], misconceptions:[] }
    KNOWLEDGE_KEYWORDS.known.forEach(w  => { if (s.includes(w)) updates[id].known_facts.push(`Detected: ${w}`) })
    KNOWLEDGE_KEYWORDS.belief.forEach(w => { if (s.includes(w)) updates[id].beliefs.push(`Detected: ${w}`) })
    KNOWLEDGE_KEYWORDS.misconception.forEach(w => { if (s.includes(w)) updates[id].misconceptions.push(`Detected: ${w}`) })
  })
  return updates
}

function applyKnowledgeUpdates(state, updates) {
  Object.keys(updates).forEach(id => {
    if (!state.characters[id]) state.characters[id] = { knowledge:{known_facts:[],beliefs:[],misconceptions:[]}, conditions:[], location:"" }
    const k = state.characters[id].knowledge
    k.known_facts.push(...updates[id].known_facts)
    k.beliefs.push(...updates[id].beliefs)
    k.misconceptions.push(...updates[id].misconceptions)
  })
}

function extractConditions(scene, nameMap) {
  const updates = {}
  const s = scene.toLowerCase()
  Object.keys(nameMap).forEach(name => {
    if (!scene.includes(name)) return
    const id = nameMap[name]
    Object.keys(CONDITION_KEYWORDS).forEach(type => {
      Object.keys(CONDITION_KEYWORDS[type]).forEach(cond => {
        CONDITION_KEYWORDS[type][cond].forEach(kw => {
          if (s.includes(kw)) {
            if (!updates[id]) updates[id] = []
            updates[id].push({ type, value: cond })
          }
        })
      })
    })
  })
  return updates
}

function applyConditionUpdates(state, updates) {
  Object.keys(updates).forEach(id => {
    if (!state.characters[id]) state.characters[id] = { knowledge:{known_facts:[],beliefs:[],misconceptions:[]}, conditions:[], location:"" }
    updates[id].forEach(newC => {
      const filtered = (state.characters[id].conditions || []).filter(c => c.type !== newC.type)
      filtered.push(newC)
      state.characters[id].conditions = filtered
    })
  })
}

// scene: restored scene with real names
// saveDir: full path to the save folder e.g. .../data/saves/save_123
export function run(scene, saveDir) {
  const statePath = `${saveDir}/story/story_state.json`
  const state      = loadJSON(statePath)
  const characters = loadCharacters(saveDir)
  const nameMap    = buildNameMap(characters)

  if (state.meta.phase === "controlled") {
    const rel = extractRelationships(scene, state, nameMap)
    applyRelationshipUpdates(state, rel)
    updateGlobalTension(state, rel)

    const know = extractKnowledge(scene, nameMap)
    applyKnowledgeUpdates(state, know)

    const cond = extractConditions(scene, nameMap)
    applyConditionUpdates(state, cond)
  }

  saveJSON(statePath, state)
}