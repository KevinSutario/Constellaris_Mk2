import { run as generateStory } from "./generate_story.js";
import { run as extractUpdate } from "./extract_update.js";

async function main() {
  try {
    console.log("Generating story...\n");

    const scene = await generateStory();

    console.log("\n--- Generated Scene ---\n");
    console.log(scene);

    console.log("\nUpdating state...\n");

    extractUpdate(scene);

    console.log("Done.\n");
  } catch (err) {
    console.error("Error:", err);
  }
}

main();