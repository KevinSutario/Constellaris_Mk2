import express from "express"
import cors from "cors"
import OpenAI from "openai"
import path from "path"
import fs, { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, copyFileSync } from "fs"
import { createReadStream } from "fs"
import { spawn } from "child_process"
import { config } from "./config/env.js"

const app    = express()
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY })

app.use(cors())
app.use(express.json())

// ─── PATHS ────────────────────────────────────────────────────────────────────
const ROOT       = "C:/Users/sutar/Documents/Constellaris_Mk2"
const CHAR_DIR   = `${ROOT}/data/characters`
const IMAGES_DIR = `${ROOT}/outputs/images`
const STORY_DIR  = `${ROOT}/data/story`
const SAVES_DIR  = `${ROOT}/data/story/saves`
const SAVES_IDX  = `${ROOT}/data/story/saves_index.json`
const SETTINGS_F = `${ROOT}/data/settings.json`

// ensure directories exist
;[SAVES_DIR].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }) })

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function loadJSON(p, fallback = {}) {
  try { return JSON.parse(readFileSync(p, "utf-8")) } catch { return fallback }
}
function saveJSON(p, data) {
  writeFileSync(p, JSON.stringify(data, null, 2))
}

const STORY_FILES = ["story_state.json", "story_memory.json", "story_slides.json", "story_log.txt"]

function copyStoryToSave(saveId) {
  const dir = `${SAVES_DIR}/${saveId}`
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  STORY_FILES.forEach(f => {
    const src = `${STORY_DIR}/${f}`
    if (existsSync(src)) copyFileSync(src, `${dir}/${f}`)
  })
}

function copyStoryFromSave(saveId) {
  const dir = `${SAVES_DIR}/${saveId}`
  STORY_FILES.forEach(f => {
    const src = `${dir}/${f}`
    if (existsSync(src)) copyFileSync(src, `${STORY_DIR}/${f}`)
  })
}

function updateSaveIndex(saveId, patch) {
  const idx = loadJSON(SAVES_IDX, { saves: [] })
  const i   = idx.saves.findIndex(s => s.id === saveId)
  if (i >= 0) Object.assign(idx.saves[i], patch)
  else         idx.saves.push({ id: saveId, ...patch })
  saveJSON(SAVES_IDX, idx)
}

// ─── GET /api/characters ──────────────────────────────────────────────────────
app.get("/api/characters", (req, res) => {
  const result = {}
  try {
    readdirSync(CHAR_DIR).forEach(file => {
      if (!file.endsWith("_personality.json")) return
      const data = JSON.parse(readFileSync(path.join(CHAR_DIR, file), "utf-8"))
      const id   = data.id
      result[id] = {
        name:      data.name,
        role:      data.role,
        imagePath: existsSync(path.join(IMAGES_DIR, `${id}_image.png`))
          ? `http://localhost:3001/images/${id}_image.png`
          : ""
      }
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: "Failed to load characters" })
  }
})

// ─── GET/POST /api/settings ───────────────────────────────────────────────────
const DEFAULT_SETTINGS = { language: "English", grammarLevel: "intermediate" }

app.get("/api/settings", (req, res) => {
  res.json(loadJSON(SETTINGS_F, DEFAULT_SETTINGS))
})

app.post("/api/settings", (req, res) => {
  const current  = loadJSON(SETTINGS_F, DEFAULT_SETTINGS)
  const updated  = { ...current, ...req.body }
  saveJSON(SETTINGS_F, updated)
  res.json(updated)
})

// ─── GET /api/saves ───────────────────────────────────────────────────────────
app.get("/api/saves", (req, res) => {
  const idx = loadJSON(SAVES_IDX, { saves: [] })
  res.json(idx.saves)
})

// ─── POST /api/saves ──────────────────────────────────────────────────────────
// Creates a new save slot, resets story files, copies blank state into save dir
app.post("/api/saves", (req, res) => {
  const { name } = req.body
  const id       = `save_${Date.now()}`
  const now      = new Date().toISOString()

  // Reset story state
  const blankState  = { meta: { current_iteration: 1, phase: "controlled", tension_level: 0 }, characters: {}, relationships: {} }
  const blankMemory = { summary: "", key_events: [], character_arcs: {} }

  saveJSON(`${STORY_DIR}/story_state.json`,  blankState)
  saveJSON(`${STORY_DIR}/story_memory.json`, blankMemory)
  writeFileSync(`${STORY_DIR}/story_log.txt`, "")
  writeFileSync(`${STORY_DIR}/story_slides.json`, "[]")

  copyStoryToSave(id)
  updateSaveIndex(id, { id, name: name || "New Story", lastEdited: now, iteration: 1 })

  res.json({ id, name, lastEdited: now, iteration: 1 })
})

// ─── PUT /api/saves/:id/name ──────────────────────────────────────────────────
app.put("/api/saves/:id/name", (req, res) => {
  const { name } = req.body
  updateSaveIndex(req.params.id, { name })
  res.json({ success: true })
})

// ─── DELETE /api/saves/:id ────────────────────────────────────────────────────
app.delete("/api/saves/:id", (req, res) => {
  const idx = loadJSON(SAVES_IDX, { saves: [] })
  idx.saves  = idx.saves.filter(s => s.id !== req.params.id)
  saveJSON(SAVES_IDX, idx)

  const dir = `${SAVES_DIR}/${req.params.id}`
  if (existsSync(dir)) fs.rmSync(dir, { recursive: true })

  res.json({ success: true })
})

// ─── POST /api/saves/:id/load ─────────────────────────────────────────────────
// Copies a save's files into the active story directory
app.post("/api/saves/:id/load", (req, res) => {
  try {
    copyStoryFromSave(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /api/continue ───────────────────────────────────────────────────────
// Runs the next story iteration, then syncs the save file
app.post("/api/continue", (req, res) => {
  const { saveId } = req.body

  const child = spawn("node", ["engines/story_system2/run_story.js"], {
    cwd: ROOT,
    env: { ...process.env }
  })

  let output = ""
  child.stdout.on("data", d => { output += d.toString(); process.stdout.write(d) })
  child.stderr.on("data", d => { output += d.toString(); process.stderr.write(d) })

  child.on("close", code => {
    if (code === 0) {
      // Sync updated story files back to the save slot
      if (saveId) {
        copyStoryToSave(saveId)
        // Update iteration count in index
        const state = loadJSON(`${STORY_DIR}/story_state.json`)
        updateSaveIndex(saveId, {
          lastEdited: new Date().toISOString(),
          iteration:  state?.meta?.current_iteration || 1
        })
      }
      res.json({ success: true, output })
    } else {
      res.status(500).json({ error: "Story generation failed", output })
    }
  })

  child.on("error", err => res.status(500).json({ error: err.message }))
})

// ─── POST /api/define ─────────────────────────────────────────────────────────
// Body: { word, sentence, grammarLevel? }
// Returns: { definition, context, example }
app.post("/api/define", async (req, res) => {
  const { word, sentence, grammarLevel = "intermediate" } = req.body
  if (!word || !sentence) return res.status(400).json({ error: "Missing word or sentence" })

  const levelMap = {
    beginner:          "very simple words and very short sentences (A1-A2 level)",
    elementary:        "simple clear sentences with common words (B1 level)",
    intermediate:      "clear sentences with some variety, suitable for high school (B2 level)",
    "upper-intermediate": "varied grammar including conditionals and complex clauses (C1 level)",
    advanced:          "sophisticated vocabulary and complex sentence structures (C2 level)"
  }
  const levelDesc = levelMap[grammarLevel] || levelMap.intermediate

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        { role: "system", content: "You are an English vocabulary assistant. Return only valid JSON." },
        {
          role: "user",
          content: `Define the word "${word}" as used in this sentence: "${sentence}"

The learner's level is: ${levelDesc}. Match your language to that level.

Return ONLY this JSON (no markdown, no fences):
{
  "definition": "clear meaning in 1-2 sentences matching the learner level",
  "context": "what '${word}' means specifically in this sentence, in 1 sentence",
  "example": "one new example sentence using '${word}' in a different context, at the learner level"
}`
        }
      ]
    })

    const raw    = response.choices[0].message.content.trim()
    const clean  = raw.replace(/```json|```/g, "").trim()
    res.json(JSON.parse(clean))
  } catch (err) {
    console.error("Define error:", err)
    res.status(500).json({ error: "Failed to get definition" })
  }
})

// ─── POST /api/quiz ───────────────────────────────────────────────────────────
app.post("/api/quiz", async (req, res) => {
  const { storyText, grammarLevel = "intermediate" } = req.body
  if (!storyText) return res.status(400).json({ error: "Missing storyText" })

  const levelMap = {
    beginner:             "very simple vocabulary, present tense only, short questions",
    elementary:           "simple questions, basic grammar, common words",
    intermediate:         "high school level, some complex vocabulary, varied question types",
    "upper-intermediate": "challenging questions, idioms, inference required",
    advanced:             "university entrance level, nuanced analysis, sophisticated vocabulary"
  }
  const levelDesc = levelMap[grammarLevel] || levelMap.intermediate

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2500,
      messages: [
        { role: "system", content: "You are an English teacher. Return only valid JSON." },
        {
          role: "user",
          content: `Create a 10-question English quiz based on this story.

Difficulty: ${levelDesc}

Split:
- 5 multiple choice (comprehension + vocabulary in context)
- 3 short answer (1-3 sentences expected)
- 2 paragraph (5-8 sentences expected, analysis + opinion)

For MC: 4 options, correct answer as index 0-3.
For short/paragraph: include a sampleAnswer.

Return ONLY JSON:
{
  "questions": [
    { "type": "mc", "question": "...", "options": ["A","B","C","D"], "answer": 0 },
    { "type": "short", "question": "...", "sampleAnswer": "..." },
    { "type": "paragraph", "question": "...", "sampleAnswer": "..." }
  ]
}

Story:
${storyText}`
        }
      ]
    })

    const raw   = response.choices[0].message.content.trim()
    const clean = raw.replace(/```json|```/g, "").trim()
    res.json(JSON.parse(clean))
  } catch (err) {
    res.status(500).json({ error: "Failed to generate quiz" })
  }
})

// ─── POST /api/grade ──────────────────────────────────────────────────────────
app.post("/api/grade", async (req, res) => {
  const { question, sampleAnswer, userAnswer, type, grammarLevel = "intermediate" } = req.body
  if (!question || !userAnswer) return res.status(400).json({ error: "Missing fields" })

  const maxScore   = type === "paragraph" ? 10 : 5
  const expectation = type === "paragraph" ? "5-8 sentences" : "1-3 sentences"

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        { role: "system", content: "You are a supportive English teacher. Be encouraging but honest. Return only valid JSON." },
        {
          role: "user",
          content: `Grade this student answer. Learner level: ${grammarLevel}.

Question: ${question}
Expected (${expectation}): ${sampleAnswer}
Student answer: ${userAnswer}

Score out of ${maxScore}. Consider comprehension, language accuracy, and depth.

Return ONLY JSON:
{
  "score": <0-${maxScore}>,
  "feedback": "<2-3 encouraging sentences: what they did well and what to improve>"
}`
        }
      ]
    })

    const raw   = response.choices[0].message.content.trim()
    const clean = raw.replace(/```json|```/g, "").trim()
    res.json(JSON.parse(clean))
  } catch (err) {
    res.status(500).json({ error: "Failed to grade answer" })
  }
})

// ─── STATIC FILES ─────────────────────────────────────────────────────────────
app.get("/slides", (req, res) => {
  res.setHeader("Content-Type", "application/json")
  createReadStream(`${STORY_DIR}/story_slides.json`)
    .on("error", () => res.status(404).json({ error: "story_slides.json not found — run run_story.js first" }))
    .pipe(res)
})

app.get("/images/:filename", (req, res) => {
  const imgPath = `${IMAGES_DIR}/${req.params.filename}`
  const ext     = path.extname(req.params.filename).toLowerCase()
  const mime    = ext === ".jpg" ? "image/jpeg" : "image/png"
  res.setHeader("Content-Type", mime)
  createReadStream(imgPath)
    .on("error", () => res.status(404).send("Image not found"))
    .pipe(res)
})

app.get("/", (req, res) => {
  createReadStream(`${ROOT}/outputs/visual_novel_trial.html`)
    .on("error", () => res.status(404).send("visual_novel_trial.html not found"))
    .pipe(res)
})

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = 3001
app.listen(PORT, () => {
  console.log(`\n✔ Constellaris API server running at http://localhost:${PORT}\n`)
  console.log("  Open the reader: http://localhost:3001")
  console.log("  GET  /api/characters")
  console.log("  GET  /api/saves  |  POST /api/saves")
  console.log("  POST /api/saves/:id/load  |  PUT /api/saves/:id/name")
  console.log("  POST /api/continue")
  console.log("  GET  /api/settings  |  POST /api/settings")
  console.log("  POST /api/define  |  /api/quiz  |  /api/grade\n")
})