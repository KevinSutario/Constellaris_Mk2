import { createCharacter } from "./engines/character_engine.js";
import { generateStoryPage } from "./engines/story_engine.js";
import fs from "fs";

async function main() {
  if (!fs.existsSync("data/characters")) {
    fs.mkdirSync("data/characters", { recursive: true });
  }

  if (!fs.existsSync("data/story")) {
    fs.mkdirSync("data/story", { recursive: true });
  }

  console.log("Creating character...");
  const character = await createCharacter();
  console.log(character);

  console.log("\nGenerating story...\n");
  const story = await generateStoryPage();
  console.log(story);
}

main();