import fs from "fs"

const BASE_PATH = "C:/Users/sutar/Documents/Constellaris_Mk2"

// paths
const statePath = `${BASE_PATH}/data/story/story_state.json`
const memoryPath = `${BASE_PATH}/data/story/story_memory.json`
const logPath = `${BASE_PATH}/data/story/story_log.txt`

function safeWriteJSON(path, data) {
  const tempPath = path + ".tmp"

  // write to temp file first
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2))

  // replace original file
  fs.renameSync(tempPath, path)
}

function resetState() {
  const state = {
    meta: {
      current_iteration: 1,
      phase: "controlled",
      tension_level: 0
    },
    characters: {},
    relationships: {}
  }

  safeWriteJSON(statePath, state)
  console.log("✔ story_state.json reset")
}

function resetMemory() {
  const memory = {
    summary: "",
    key_events: [],
    character_arcs: {}
  }

  safeWriteJSON(memoryPath, memory)
  console.log("✔ story_memory.json reset")
}

function resetLog() {
  // force delete if exists
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath)
  }

  // recreate clean file
  fs.writeFileSync(logPath, "")

  console.log("✔ story_log.txt reset")
}

function ensureDirectories() {
  const storyDir = `${BASE_PATH}/data/story`

  if (!fs.existsSync(storyDir)) {
    fs.mkdirSync(storyDir, { recursive: true })
  }
}

function main() {
  try {
    console.log("\n--- Resetting Story ---\n")

    ensureDirectories()

    resetState()
    resetMemory()
    resetLog()

    console.log("\n✔ Story reset complete\n")
  } catch (err) {
    console.error("❌ Reset failed:", err)
  }
}

main()