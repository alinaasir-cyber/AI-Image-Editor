import { NextRequest, NextResponse } from "next/server";
import { saveGeneratedImage } from "@/lib/db";

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
    [/\blibaax\b/gi, "majestic lion"],
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
    [/\bnin\b/gi, "man in stylish suit"],
    [/\brag\b/gi, "men"],
    [/\bhaweenay\b/gi, "woman"],
    [/\bnaag\b/gi, "woman"],
    [/\bgabar\b/gi, "girl"],
    [/\bwiil\b/gi, "boy"],
    [/\bbaabuur\b/gi, "luxury car"],
    [/\bgaari\b/gi, "car"],
    [/\bsuudh\b/gi, "suit"],
    [/\bdhar\b/gi, "clothes"],
    [/\bmuraayad\b/gi, "sunglasses"],
    [/\bbad\b/gi, "turquoise ocean with gentle waves"],
    [/\bbadda\b/gi, "ocean sea"],
    [/\bbuur\b/gi, "mountain"],
    [/\bqorrax\b/gi, "sun sunset golden hour"],
    [/\bdayax\b/gi, "moon glowing"],
    [/\bhabeen\b/gi, "night sky"],
    [/\bcasri\b/gi, "futuristic modern"],
    [/\bqurux\b/gi, "beautiful masterpiece 4k"],
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

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const translated = translateSomaliPrompt(prompt);
    const cleanPrompt = translated || prompt;
    const seed = Math.floor(Math.random() * 1000000);
    const outputUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      cleanPrompt
    )}?width=1024&height=1024&seed=${seed}&nologo=true`;

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
    return NextResponse.json(
      { error: error?.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
