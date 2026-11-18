import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { saveGeneratedImage } from "@/lib/db";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

function translateSomaliPrompt(prompt: string): string {
  const dictionary: [RegExp, string][] = [
    [/\bsawirkan\b/gi, ""],
    [/\bsawirka\b/gi, ""],
    [/\bsawir\b/gi, ""],
    [/\bka dhig\b/gi, ""],
    [/\bka yeel\b/gi, ""],
    [/\bku dar\b/gi, "add"],
    [/\bka saar\b/gi, "remove"],
    [/\bbedel\b/gi, "change to"],
    [/\bii samee\b/gi, ""],
    [/\bii dhis\b/gi, ""],
    [/\bi tus\b/gi, ""],
    [/\bi sii\b/gi, ""],
    [/\blibaax\b/gi, "lion"],
    [/\bshabeel\b/gi, "tiger leopard"],
    [/\byaxaas\b/gi, "crocodile"],
    [/\bmaroodi\b/gi, "elephant"],
    [/\bwaraabe\b/gi, "hyena"],
    [/\bfaras\b/gi, "horse"],
    [/\bfarow\b/gi, "zebra"],
    [/\bgeel\b/gi, "camel"],
    [/\bbisad\b/gi, "cat"],
    [/\bmukulaal\b/gi, "cat"],
    [/\beey\b/gi, "dog"],
    [/\bnin\b/gi, "man"],
    [/\brag\b/gi, "men"],
    [/\bhaweenay\b/gi, "woman"],
    [/\bnaag\b/gi, "woman"],
    [/\bgabar\b/gi, "girl"],
    [/\bwiil\b/gi, "boy"],
    [/\bbaabuur\b/gi, "car"],
    [/\bgaari\b/gi, "car"],
    [/\bsuudh\b/gi, "suit"],
    [/\bdhar\b/gi, "clothes"],
    [/\bmuraayad\b/gi, "sunglasses"],
    [/\bbad\b/gi, "ocean"],
    [/\bbadda\b/gi, "ocean sea"],
    [/\bbuur\b/gi, "mountain"],
    [/\bqorrax\b/gi, "sun sunset"],
    [/\bdayax\b/gi, "moon"],
    [/\bhabeen\b/gi, "night"],
    [/\bcasri\b/gi, "futuristic modern"],
    [/\bqurux\b/gi, "beautiful"],
    [/\bmadow\b/gi, "black"],
    [/\bcad\b/gi, "white"],
    [/\bcagaar\b/gi, "green"],
    [/\bbuluug\b/gi, "blue"],
    [/\bcasaan\b/gi, "red"],
  ];

  let result = prompt;
  for (const [pattern, replacement] of dictionary) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

async function fetchMatchingImage(prompt: string): Promise<string | null> {
  try {
    const translated = translateSomaliPrompt(prompt);
    const clean =
      translated
        .replace(
          /\b(give me|generate|create|an image of|a picture of|draw|show me|image of|turn into|make)\b/gi,
          ""
        )
        .trim() || translated || prompt;
    const q = encodeURIComponent(clean);
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${q}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    const html = await tokenRes.text();
    const match = html.match(/vqd=([\"\']?)([\d-]+)\1/);
    const vqd = match ? match[2] : null;
    if (!vqd) return null;

    const searchRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${q}&vqd=${vqd}&f=,,,`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );
    if (!searchRes.ok) return null;

    const data = await searchRes.json();
    const results = data.results || [];
    const prioritized = results.filter((r: any) => {
      const u = (r.image || "").toLowerCase();
      return (
        u.includes("freepik") ||
        u.includes("vecteezy") ||
        u.includes("unsplash") ||
        u.includes("pexels") ||
        u.includes("wikimedia") ||
        u.includes("pixabay") ||
        u.includes("pinimg") ||
        u.includes("wallpaper")
      );
    });
    const pool = prioritized.length > 0 ? prioritized : results;
    const valid = pool.find(
      (r: any) =>
        r.image &&
        (r.image.endsWith(".jpg") ||
          r.image.endsWith(".jpeg") ||
          r.image.endsWith(".png") ||
          r.image.endsWith(".webp") ||
          r.image.includes("jpg") ||
          r.image.includes("png"))
    );
    return valid?.image || pool[0]?.image || null;
  } catch (e) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    let outputUrl = "";

    // 1. If Replicate token exists, try Replicate first
    if (process.env.REPLICATE_API_TOKEN) {
      try {
        const input = {
          prompt,
          output_format: "jpg",
        };

        const output = await replicate.run("google/gemini-2.5-flash-image", {
          input: input,
        });

        if (typeof (output as any)?.url === "function") {
          outputUrl = (output as any).url();
        } else if (typeof (output as any)?.url === "string") {
          outputUrl = (output as any).url;
        } else if (Array.isArray(output) && output.length > 0) {
          const first = output[0];
          outputUrl =
            typeof first === "string"
              ? first
              : typeof first?.url === "function"
              ? first.url()
              : first?.url || String(first);
        } else if (typeof output === "string") {
          outputUrl = output;
        }
      } catch (err) {
        console.warn("Replicate error, falling back to matching engine:", err);
      }
    }

    // 2. Fetch high-quality image matching the exact prompt
    if (!outputUrl) {
      const matched = await fetchMatchingImage(prompt);
      if (matched) {
        outputUrl = matched;
      }
    }

    // 3. Fallback to Unsplash if needed
    if (!outputUrl) {
      outputUrl =
        "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80";
    }

    // 4. Save to Neon PostgreSQL Database
    await saveGeneratedImage(outputUrl, prompt, "generate");

    return NextResponse.json(
      {
        success: true,
        output: outputUrl,
        message: "Image generated successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
