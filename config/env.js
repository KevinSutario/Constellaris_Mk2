import dotenv from "dotenv";

dotenv.config();

export const config = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};