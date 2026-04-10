import OpenAI from "openai"
import fs from "fs"
import { config } from "../../config/env.js"

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY })

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

// Takes a restored scene (real names) and a characters map,
// returns an array of slide objects saved to story_slides.json

export async function parseSlides(scene, characters) {
  const characterNames = Object.values(characters)
    .map(c => c.personality?.name)
    .filter(Boolean)

  const prompt = `
You are a visual novel scene parser.

Convert the following story scene into a JSON array of slides.

Each slide must be ONE of these types:

1. NARRATOR — background text, no character speaking
   { "type": "narrator", "text": "..." }

2. MONOLOGUE — one character thinking or speaking alone
   { "type": "monologue", "speaker": "<name>", "text": "..." }

3. DIALOGUE — a character speaking to others
   { "type": "dialogue", "speaker": "<name>", "text": "..." }

RULES:
- ONE sentence or speech act per slide. Never combine two sentences into one slide.
- Dialogue is text inside quotes spoken by a character.
- Narration is descriptive prose with no speaker.
- Internal thoughts count as monologue.
- Split long narrator paragraphs into multiple narrator slides (max 2 sentences each).
- The "text" field must contain ONLY the spoken words or narration — no speaker attribution like "he said" or "she whispered".
- Speaker names must be exactly one of: ${characterNames.join(", ")}
- If a speaker cannot be identified, use type "narrator".

Return ONLY a valid JSON array. No explanation, no markdown, no code fences.

Scene:
${scene}
`

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a precise JSON formatter for visual novel scripts. Return only valid JSON arrays." },
      { role: "user", content: prompt }
    ],
    max_tokens: 3000
  })

  const raw = response.choices[0].message.content.trim()

  // Strip any accidental markdown fences
  const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()

  let slides
  try {
    slides = JSON.parse(clean)
  } catch (err) {
    console.error("Failed to parse slides JSON:", err)
    console.error("Raw output was:", raw)
    // Fallback: wrap entire scene as a single narrator slide
    slides = [{ type: "narrator", text: scene }]
  }

  // Save to disk
  const slidesPath = `${BASE_PATH}/data/story/story_slides.json`

  let existing = []
  if (fs.existsSync(slidesPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(slidesPath, "utf-8"))
    } catch {
      existing = []
    }
  }

  const updated = existing.concat(slides)
  fs.writeFileSync(slidesPath, JSON.stringify(updated, null, 2))

  return slides
}