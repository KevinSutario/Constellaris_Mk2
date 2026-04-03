import { createMultipleCharacters } from "./engines/character_system/generate_personality.js";
import { generateAllAppearances } from "./engines/character_system/generate_appearance_JSON.js";

async function main() {
  try {
    console.log("Starting character generation...\n");

    // Step 1: Generate personalities
    await createMultipleCharacters(5);

    console.log("\nStarting appearance generation...\n");

    // Step 2: Generate appearances (reads personality files)
    await generateAllAppearances(5);

    console.log("\nDone.");
  } catch (err) {
    console.error("Error in main:", err);
  }
}

main();