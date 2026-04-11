import express from "express"
import cors from "cors"
import OpenAI from "openai"
import path from "path"
import { readdirSync, readFileSync, existsSync } from "fs"
import { config } from "./config/env.js"

const app = express()
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY })

app.use(cors())
app.use(express.json())


// ─── GET /api/characters ──────────────────────────────────────────────────────
// Reads all C00X_personality.json files and returns character config
// including name, role, and image path — so the HTML never needs hardcoded names.
const CHAR_DIR   = "C:/Users/sutar/Documents/Constellaris_Mk2/data/characters"
const IMAGES_DIR = "C:/Users/sutar/Documents/Constellaris_Mk2/outputs/images"

app.get("/api/characters", (req, res) => {
  const result = {}

  try {
    const files = readdirSync(CHAR_DIR)

    files.forEach(file => {
      if (!file.endsWith("_personality.json")) return

      const fullPath = path.join(CHAR_DIR, file)
      const data = JSON.parse(readFileSync(fullPath, "utf-8"))
      const id = data.id  // e.g. "C001"

      const imagePath = path.join(IMAGES_DIR, `${id}_image.png`).split(path.sep).join('/')

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
    console.error("Characters error:", err)
    res.status(500).json({ error: "Failed to load characters" })
  }
})

// ─── POST /api/define ─────────────────────────────────────────────────────────
// Body: { word: string, sentence: string }
// Returns: { definition: string, context: string }
app.post("/api/define", async (req, res) => {
  const { word, sentence } = req.body

  if (!word || !sentence) {
    return res.status(400).json({ error: "Missing word or sentence" })
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: "You are an English vocabulary assistant for high school learners. Return only valid JSON."
        },
        {
          role: "user",
          content: `Define the word "${word}" as used in this sentence: "${sentence}"

Return ONLY this JSON (no markdown, no fences):
{
  "definition": "simple, clear meaning in 1-2 sentences",
  "context": "what this word means specifically in the sentence above, in 1 sentence"
}`
        }
      ]
    })

    const raw = response.choices[0].message.content.trim()
    const clean = raw.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)

    res.json(parsed)
  } catch (err) {
    console.error("Define error:", err)
    res.status(500).json({ error: "Failed to get definition" })
  }
})

// ─── POST /api/quiz ───────────────────────────────────────────────────────────
// Body: { storyText: string }
// Returns: { questions: QuizQuestion[] }
//
// QuizQuestion shape:
//   MC:          { type: "mc", question, options: [string x4], answer: number (0-3) }
//   Short:       { type: "short", question, sampleAnswer: string }
//   Paragraph:   { type: "paragraph", question, sampleAnswer: string }

app.post("/api/quiz", async (req, res) => {
  const { storyText } = req.body

  if (!storyText) {
    return res.status(400).json({ error: "Missing storyText" })
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: "You are an English teacher creating comprehension and language quizzes for high school students. Return only valid JSON."
        },
        {
          role: "user",
          content: `Based on the following story, create a quiz with exactly 10 questions for high school English learners.

Split:
- 5 multiple choice questions (comprehension + vocabulary in context)
- 3 short answer questions (1-3 sentences expected, test understanding)
- 2 paragraph questions (5-8 sentences expected, test analysis and opinion)

For MC: provide 4 options, indicate the correct answer as index 0-3.
For short/paragraph: provide a sample answer.

Return ONLY this JSON:
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

    const raw = response.choices[0].message.content.trim()
    const clean = raw.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)

    res.json(parsed)
  } catch (err) {
    console.error("Quiz error:", err)
    res.status(500).json({ error: "Failed to generate quiz" })
  }
})

// ─── POST /api/grade ──────────────────────────────────────────────────────────
// Body: { question: string, sampleAnswer: string, userAnswer: string, type: "short"|"paragraph" }
// Returns: { score: number (0-10), feedback: string }

app.post("/api/grade", async (req, res) => {
  const { question, sampleAnswer, userAnswer, type } = req.body

  if (!question || !userAnswer) {
    return res.status(400).json({ error: "Missing fields" })
  }

  const maxScore = type === "paragraph" ? 10 : 5
  const expectation = type === "paragraph"
    ? "5-8 sentences with analysis and personal opinion"
    : "1-3 sentences with clear comprehension"

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: "You are a supportive high school English teacher grading student answers. Be encouraging but honest."
        },
        {
          role: "user",
          content: `Grade this student answer for a high school English quiz.

Question: ${question}
Expected (${expectation}): ${sampleAnswer}
Student answer: ${userAnswer}

Score out of ${maxScore}. Consider: comprehension, language accuracy, and depth.

Return ONLY this JSON:
{
  "score": <number 0-${maxScore}>,
  "feedback": "<2-3 sentences: what they did well, what to improve>"
}`
        }
      ]
    })

    const raw = response.choices[0].message.content.trim()
    const clean = raw.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)

    res.json(parsed)
  } catch (err) {
    console.error("Grade error:", err)
    res.status(500).json({ error: "Failed to grade answer" })
  }
})

// ─── STATIC FILES ─────────────────────────────────────────────────────────────
// Serves the visual novel HTML and the story_slides.json through the server
// so Chrome doesn't block local file access
import { createReadStream } from "fs"
import { extname } from "path"

const PROJECT_ROOT = "C:/Users/sutar/Documents/Constellaris_Mk2"

// Serve story_slides.json
app.get("/slides", (req, res) => {
  const slidesPath = `${PROJECT_ROOT}/data/story/story_slides.json`
  res.setHeader("Content-Type", "application/json")
  createReadStream(slidesPath)
    .on("error", () => res.status(404).json({ error: "story_slides.json not found — run run_story.js first" }))
    .pipe(res)
})

// Serve character images
app.get("/images/:filename", (req, res) => {
  const imgPath = `${PROJECT_ROOT}/outputs/images/${req.params.filename}`
  const ext = extname(req.params.filename).toLowerCase()
  const mime = ext === ".png" ? "image/png" : ext === ".jpg" ? "image/jpeg" : "image/png"
  res.setHeader("Content-Type", mime)
  createReadStream(imgPath)
    .on("error", () => res.status(404).send("Image not found"))
    .pipe(res)
})

// Serve the HTML reader itself
app.get("/", (req, res) => {
  createReadStream(`${PROJECT_ROOT}/outputs/visual_novel_trial.html`)
    .on("error", () => res.status(404).send("visual_novel_trial.html not found"))
    .pipe(res)
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`\n✔ Constellaris API server running at http://localhost:${PORT}\n`)
  console.log("  Open the reader at: http://localhost:3001")
  console.log("  POST /api/define  — word definitions")
  console.log("  POST /api/quiz    — generate quiz from story")
  console.log("  POST /api/grade   — grade short/paragraph answers\n")
})