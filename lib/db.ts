import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || "";

export const sql = connectionString ? neon(connectionString) : null;

export async function saveGeneratedImage(url: string, prompt: string, type: string = "generate") {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO generated_images (url, prompt, type)
      VALUES (${url}, ${prompt}, ${type})
    `;
  } catch (error) {
    console.error("Failed to save image to Neon database:", error);
  }
}
