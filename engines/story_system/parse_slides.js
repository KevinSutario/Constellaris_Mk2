import OpenAI from "openai"
import fs from "fs"
import { config } from "../../config/env.js"

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY })

// scene:     restored scene with real names
// characters: loaded characters map
// saveDir:   full path to save folder
// language:  story language e.g. "English", "Indonesian"
export async function parseSlides(scene, characters, saveDir, language = "English") {
  const characterNames = Object.values(characters)
    .map(c => c.personality?.name)
    .filter(Boolean)

  const langNote = language !== "English"
    ? `The scene is written in ${language}. Keep all text exactly as written — do not translate.`
    : ""

  const prompt = `
You are a visual novel scene parser.
${langNote}

Convert the following story scene into a JSON array of slides.

Each slide must be ONE of:
1. NARRATOR  — { "type": "narrator", "text": "..." }
2. MONOLOGUE — { "type": "monologue", "speaker": "<name>", "text": "..." }
3. DIALOGUE  — { "type": "dialogue",  "speaker": "<name>", "text": "..." }

RULES:
- ONE sentence or speech act per slide. Never combine two sentences.
- Split long narrator paragraphs into max 2 sentences per slide.
- "text" must contain ONLY the spoken/narrated words — no attribution like "he said".
- Speaker names must be exactly one of: ${characterNames.join(", ")}
- If speaker cannot be identified, use type "narrator".

Return ONLY a valid JSON array. No explanation, no markdown, no fences.

Scene:
${scene}
`

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a precise JSON formatter for visual novel scripts. Return only valid JSON arrays." },
      { role: "user",   content: prompt }
    ],
    max_tokens: 3000
  })

  const raw   = response.choices[0].message.content.trim()
  const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()

  let slides
  try {
    slides = JSON.parse(clean)
  } catch (err) {
    console.error("Failed to parse slides JSON:", err)
    slides = [{ type: "narrator", text: scene }]
  }

  // Append to existing slides file
  const slidesPath = `${saveDir}/story/story_slides.json`
  let existing = []
  if (fs.existsSync(slidesPath)) {
    try { existing = JSON.parse(fs.readFileSync(slidesPath, "utf-8")) } catch { existing = [] }
  }

  const updated = existing.concat(slides)
  fs.writeFileSync(slidesPath, JSON.stringify(updated, null, 2))

  return slides
}