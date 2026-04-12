import express from "express"
import cors    from "cors"
import OpenAI  from "openai"
import path    from "path"
import fs      from "fs"
import { createReadStream }        from "fs"
import { spawn }                   from "child_process"
import { config }                  from "./config/env.js"
import { createCharactersForSave } from "./engines/character_system/generate_personality.js"
import { generateAllAppearances }  from "./engines/character_system/generate_appearance_json.js"
import { generateAllCharacterImages } from "./engines/character_system/generate_character_image.js"

const app    = express()
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY })

app.use(cors())
app.use(express.json())

// ─── PATHS ────────────────────────────────────────────────────────────────────
const ROOT      = "C:/Users/sutar/Documents/Constellaris_Mk2"
const SAVES_DIR = `${ROOT}/data/saves`
const CHAR_DIR  = `${ROOT}/data/characters`   // template reference only

if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true })

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function loadJSON(p, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) } catch { return fallback }
}
function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

function getSaveDir(saveId) { return `${SAVES_DIR}/${saveId}` }

function createSaveStructure(saveId) {
  const base = getSaveDir(saveId)
  ;[
    `${base}/characters`,
    `${base}/story`,
    `${base}/images`
  ].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) })
  return base
}

function blankStoryFiles(saveDir) {
  const storyDir = `${saveDir}/story`
  saveJSON(`${storyDir}/story_state.json`,  {
    meta: { current_iteration: 1, phase: "controlled", tension_level: 0 },
    characters: {}, relationships: {}
  })
  saveJSON(`${storyDir}/story_memory.json`, { summary:"", key_events:[], character_arcs:{} })
  fs.writeFileSync(`${storyDir}/story_log.txt`,      "")
  fs.writeFileSync(`${storyDir}/story_slides.json`, "[]")
}

function readMeta(saveId) {
  return loadJSON(`${getSaveDir(saveId)}/meta.json`, null)
}

function writeMeta(saveId, patch) {
  const existing = readMeta(saveId) || {}
  const updated  = { ...existing, ...patch }
  saveJSON(`${getSaveDir(saveId)}/meta.json`, updated)
  return updated
}

// Track background image generation status
const imageGenStatus = {}   // { [saveId]: "pending" | "done" | "failed" }

async function runImageGenerationInBackground(saveId) {
  const saveDir = getSaveDir(saveId)
  imageGenStatus[saveId] = "pending"
  try {
    await generateAllCharacterImages(saveDir, 5)
    imageGenStatus[saveId] = "done"
    writeMeta(saveId, { imagesReady: true })
    console.log(`✔ Images ready for ${saveId}`)
  } catch (err) {
    imageGenStatus[saveId] = "failed"
    console.error(`Image gen failed for ${saveId}:`, err.message)
  }
}

// ─── GET /api/saves ───────────────────────────────────────────────────────────
app.get("/api/saves", (req, res) => {
  try {
    const saves = fs.readdirSync(SAVES_DIR)
      .filter(d => fs.statSync(`${SAVES_DIR}/${d}`).isDirectory())
      .map(d => {
        const meta = loadJSON(`${SAVES_DIR}/${d}/meta.json`, null)
        if (!meta) return null
        return { ...meta, imageStatus: imageGenStatus[d] || (meta.imagesReady ? "done" : "pending") }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastEdited) - new Date(a.lastEdited))

    res.json(saves)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /api/saves ──────────────────────────────────────────────────────────
// Body: { name, language, grammarLevel }
// 1. Creates folder structure
// 2. Generates 5 personalities + appearances (blocking — fast ~10s)
// 3. Kicks off image generation in background (slow)
// 4. Returns save metadata immediately
app.post("/api/saves", async (req, res) => {
  const { name = "New Story", language = "English", grammarLevel = "intermediate" } = req.body
  const saveId  = `save_${Date.now()}`
  const saveDir = createSaveStructure(saveId)
  const now     = new Date().toISOString()

  try {
    console.log(`\nCreating save ${saveId}...`)

    // Write meta first so the save appears in list
    writeMeta(saveId, { id: saveId, name, language, grammarLevel, iteration: 1, lastEdited: now, imagesReady: false, status: "generating_characters" })

    // Generate personalities (blocking)
    console.log("Generating personalities...")
    await createCharactersForSave(saveDir)

    // Generate appearances (blocking)
    console.log("Generating appearances...")
    await generateAllAppearances(saveDir, 5)

    // Update status
    writeMeta(saveId, { status: "ready" })

    // Blank story files
    blankStoryFiles(saveDir)

    // Kick off image generation in background (non-blocking)
    runImageGenerationInBackground(saveId)

    const meta = readMeta(saveId)
    res.json(meta)

  } catch (err) {
    console.error("Save creation failed:", err)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/saves/:id ───────────────────────────────────────────────────────
app.get("/api/saves/:id", (req, res) => {
  const meta = readMeta(req.params.id)
  if (!meta) return res.status(404).json({ error: "Save not found" })
  res.json({ ...meta, imageStatus: imageGenStatus[req.params.id] || (meta.imagesReady ? "done" : "pending") })
})

// ─── PUT /api/saves/:id/name ──────────────────────────────────────────────────
app.put("/api/saves/:id/name", (req, res) => {
  const meta = writeMeta(req.params.id, { name: req.body.name })
  res.json(meta)
})

// ─── DELETE /api/saves/:id ────────────────────────────────────────────────────
app.delete("/api/saves/:id", (req, res) => {
  const saveDir = getSaveDir(req.params.id)
  if (fs.existsSync(saveDir)) fs.rmSync(saveDir, { recursive: true })
  delete imageGenStatus[req.params.id]
  res.json({ success: true })
})

// ─── POST /api/continue ───────────────────────────────────────────────────────
// Body: { saveId }
// Spawns run_story.js and waits for completion
app.post("/api/continue", (req, res) => {
  const { saveId } = req.body
  if (!saveId) return res.status(400).json({ error: "saveId required" })

  const meta     = readMeta(saveId)
  const language = meta?.language || "English"

  const child = spawn(
    "node",
    ["engines/story_system/run_story.js", "--save", saveId, "--lang", language],
    { cwd: ROOT, env: { ...process.env } }
  )

  let output = ""
  child.stdout.on("data", d => { output += d.toString(); process.stdout.write(d) })
  child.stderr.on("data", d => { output += d.toString(); process.stderr.write(d) })

  child.on("close", code => {
    if (code === 0) {
      const state = loadJSON(`${getSaveDir(saveId)}/story/story_state.json`)
      writeMeta(saveId, {
        lastEdited: new Date().toISOString(),
        iteration:  state?.meta?.current_iteration || 1
      })
      res.json({ success: true })
    } else {
      res.status(500).json({ error: "Story generation failed", output })
    }
  })

  child.on("error", err => res.status(500).json({ error: err.message }))
})

// ─── GET /api/characters/:saveId ─────────────────────────────────────────────
app.get("/api/characters/:saveId", (req, res) => {
  const saveDir = getSaveDir(req.params.saveId)
  const charDir = `${saveDir}/characters`

  if (!fs.existsSync(charDir)) return res.status(404).json({ error: "No characters found" })

  const result = {}
  fs.readdirSync(charDir).forEach(file => {
    if (!file.endsWith("_personality.json")) return
    const data = JSON.parse(fs.readFileSync(path.join(charDir, file), "utf-8"))
    const id   = data.id
    const imgPath = `${saveDir}/images/${id}_image.png`
    result[id] = {
      name:      data.name,
      role:      data.role,
      imagePath: fs.existsSync(imgPath)
        ? `http://localhost:3001/images/${req.params.saveId}/${id}_image.png`
        : ""
    }
  })

  res.json(result)
})

// ─── GET/POST /api/settings ───────────────────────────────────────────────────
const SETTINGS_PATH    = `${ROOT}/data/settings.json`
const DEFAULT_SETTINGS = { systemLanguage: "English", grammarLevel: "intermediate" }

app.get("/api/settings", (req, res) => res.json(loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS)))

app.post("/api/settings", (req, res) => {
  const updated = { ...loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS), ...req.body }
  saveJSON(SETTINGS_PATH, updated)
  res.json(updated)
})

// ─── POST /api/define ─────────────────────────────────────────────────────────
app.post("/api/define", async (req, res) => {
  const { word, sentence, grammarLevel = "intermediate", storyLanguage = "English" } = req.body
  if (!word || !sentence) return res.status(400).json({ error: "Missing word or sentence" })

  const levelMap = {
    beginner:             "very simple words and very short sentences (A1-A2)",
    elementary:           "simple clear sentences with common words (B1)",
    intermediate:         "clear sentences suitable for high school (B2)",
    "upper-intermediate": "varied grammar including conditionals (C1)",
    advanced:             "sophisticated vocabulary and complex structures (C2)"
  }
  const levelDesc = levelMap[grammarLevel] || levelMap.intermediate

  const langNote = storyLanguage !== "English"
    ? `The story is written in ${storyLanguage}. The word "${word}" appears in a ${storyLanguage} sentence. Provide definition, context, and example IN ${storyLanguage}.`
    : ""

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 350,
      messages: [
        { role: "system", content: "You are an English vocabulary assistant. Return only valid JSON." },
        {
          role: "user",
          content: `${langNote}
Define the word "${word}" as used in this sentence: "${sentence}"
Learner level: ${levelDesc}

Return ONLY this JSON (no markdown):
{
  "definition": "clear meaning in 1-2 sentences at the learner level",
  "context": "what '${word}' means specifically in this sentence, 1 sentence",
  "example": "a new example sentence using '${word}' in a different context at the learner level"
}`
        }
      ]
    })
    const clean = response.choices[0].message.content.trim().replace(/```json|```/g, "").trim()
    res.json(JSON.parse(clean))
  } catch (err) {
    console.error("Define error:", err)
    res.status(500).json({ error: "Failed to get definition" })
  }
})

// ─── POST /api/quiz ───────────────────────────────────────────────────────────
app.post("/api/quiz", async (req, res) => {
  const { storyText, grammarLevel = "intermediate", storyLanguage = "English" } = req.body
  if (!storyText) return res.status(400).json({ error: "Missing storyText" })

  const levelMap = {
    beginner:             "very simple vocabulary, present tense only",
    elementary:           "simple questions, basic grammar",
    intermediate:         "high school level, varied question types",
    "upper-intermediate": "challenging, idioms, inference required",
    advanced:             "university level, nuanced analysis"
  }

  const langNote = storyLanguage !== "English"
    ? `The story is in ${storyLanguage}. Write ALL questions and answers in ${storyLanguage}.`
    : ""

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2500,
      messages: [
        { role: "system", content: "You are an English teacher. Return only valid JSON." },
        {
          role: "user",
          content: `${langNote}
Create a 10-question quiz. Difficulty: ${levelMap[grammarLevel] || levelMap.intermediate}

Split: 5 MC, 3 short answer, 2 paragraph.
MC: 4 options, correct answer index 0-3.
Short/paragraph: include sampleAnswer.

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
    const clean = response.choices[0].message.content.trim().replace(/```json|```/g, "").trim()
    res.json(JSON.parse(clean))
  } catch (err) {
    res.status(500).json({ error: "Failed to generate quiz" })
  }
})

// ─── POST /api/grade ──────────────────────────────────────────────────────────
app.post("/api/grade", async (req, res) => {
  const { question, sampleAnswer, userAnswer, type, grammarLevel = "intermediate", storyLanguage = "English" } = req.body
  if (!question || !userAnswer) return res.status(400).json({ error: "Missing fields" })

  const maxScore    = type === "paragraph" ? 10 : 5
  const expectation = type === "paragraph" ? "5-8 sentences" : "1-3 sentences"
  const langNote    = storyLanguage !== "English" ? `The quiz is in ${storyLanguage}. Provide feedback in ${storyLanguage}.` : ""

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        { role: "system", content: "You are a supportive English teacher. Return only valid JSON." },
        {
          role: "user",
          content: `${langNote}
Grade this student answer. Level: ${grammarLevel}.
Question: ${question}
Expected (${expectation}): ${sampleAnswer}
Student answer: ${userAnswer}

Score out of ${maxScore}. Consider comprehension, language accuracy, depth.

Return ONLY JSON:
{"score":<0-${maxScore}>,"feedback":"<2-3 encouraging sentences>"}`
        }
      ]
    })
    const clean = response.choices[0].message.content.trim().replace(/```json|```/g, "").trim()
    res.json(JSON.parse(clean))
  } catch (err) {
    res.status(500).json({ error: "Failed to grade answer" })
  }
})

// ─── STATIC FILES ─────────────────────────────────────────────────────────────
// Slides per save
app.get("/slides/:saveId", (req, res) => {
  const p = `${getSaveDir(req.params.saveId)}/story/story_slides.json`
  res.setHeader("Content-Type", "application/json")
  createReadStream(p)
    .on("error", () => res.status(404).json({ error: "Slides not found — run continue first" }))
    .pipe(res)
})

// Images per save
app.get("/images/:saveId/:filename", (req, res) => {
  const imgPath = `${getSaveDir(req.params.saveId)}/images/${req.params.filename}`
  const ext     = path.extname(req.params.filename).toLowerCase()
  res.setHeader("Content-Type", ext === ".jpg" ? "image/jpeg" : "image/png")
  createReadStream(imgPath)
    .on("error", () => res.status(404).send("Image not found"))
    .pipe(res)
})

// Serve HTML
app.get("/", (req, res) => {
  createReadStream(`${ROOT}/outputs/visual_novel_trial.html`)
    .on("error", () => res.status(404).send("visual_novel_trial.html not found"))
    .pipe(res)
})

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = 3001
app.listen(PORT, () => {
  console.log(`\n✔ Constellaris API — http://localhost:${PORT}\n`)
  console.log("  GET  /api/saves           — list saves")
  console.log("  POST /api/saves           — create save (generates characters)")
  console.log("  GET  /api/saves/:id       — get one save")
  console.log("  PUT  /api/saves/:id/name  — rename")
  console.log("  DELETE /api/saves/:id     — delete")
  console.log("  POST /api/continue        — run next iteration")
  console.log("  GET  /api/characters/:saveId")
  console.log("  GET  /api/settings  POST /api/settings")
  console.log("  POST /api/define  /api/quiz  /api/grade\n")
})