import { createMultipleCharacters } from "./engines/character_system/generate_personality.js";

async function main() {
  try {
    console.log("Starting character generation...\n");

    // generate 3–5 characters (you can change this number)
    await createMultipleCharacters(5);

    console.log("\nDone.");
  } catch (err) {
    console.error("Error in main:", err);
  }
}

main();