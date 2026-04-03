import OpenAI from "openai";
import { config } from "../config/env.js";
import fs from "fs";

const client = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

export async function generateStoryPage() {
  const prompt = `
Write a short fantasy story (100-150 words) set in Hong Kong with a magical gate.
Make it suitable for children aged 9-12.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a story writer." },
      { role: "user", content: prompt },
    ],
  });

  const story = response.choices[0].message.content;

  fs.appendFileSync("data/story/story_log.txt", story + "\n\n");

  return story;
}
