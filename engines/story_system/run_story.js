import { run as generateStory } from "./generate_story.js"
import { run as extractUpdate  } from "./extract_update.js"

// Parse CLI args: --save <saveId> --lang <language>
const args    = process.argv.slice(2)
const saveIdx = args.indexOf("--save")
const langIdx = args.indexOf("--lang")

const saveId   = saveIdx !== -1 ? args[saveIdx + 1] : null
const language = langIdx !== -1 ? args[langIdx + 1] : "English"

if (!saveId) {
  console.error("Error: --save <saveId> is required")
  process.exit(1)
}

const ROOT    = "C:/Users/sutar/Documents/Constellaris_Mk2"
const saveDir = `${ROOT}/data/saves/${saveId}`

async function main() {
  try {
    console.log(`\nGenerating story for save: ${saveId} | language: ${language}\n`)

    const scene = await generateStory(saveDir, language)

    if (!scene) {
      console.log("No valid scene generated. Skipping state update.")
      return
    }

    console.log("\n--- Generated Scene ---\n")
    console.log(scene)

    extractUpdate(scene, saveDir)

    console.log("\nDone.\n")
  } catch (err) {
    console.error("Error:", err)
    process.exit(1)
  }
}

main()