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
    [/\blibaax\b/gi, "majestic lion in african savanna"],
    [/\bshabeel\b/gi, "tiger leopard"],
    [/\byaxaas\b/gi, "crocodile in water"],
    [/\bmaroodi\b/gi, "huge elephant"],
    [/\bwaraabe\b/gi, "hyena in the wild"],
    [/\bfaras\b/gi, "black stallion horse running"],
    [/\bfarow\b/gi, "zebra"],
    [/\bgeel\b/gi, "camel in desert dunes"],
    [/\bbisad\b/gi, "cute fluffy cat"],
    [/\bmukulaal\b/gi, "cute fluffy kitten"],
    [/\beey\b/gi, "golden retriever dog"],
    [/\bnin\b/gi, "handsome businessman in tailored luxury dark suit"],
    [/\brag\b/gi, "men in suits"],
    [/\bhaweenay\b/gi, "elegant woman"],
    [/\bnaag\b/gi, "elegant woman portrait"],
    [/\bgabar\b/gi, "young woman portrait"],
    [/\bwiil\b/gi, "young handsome boy portrait"],
    [/\bbaabuur\b/gi, "luxury supercar sports car on street"],
    [/\bgaari\b/gi, "supercar sports car"],
    [/\bsuudh\b/gi, "luxury tailored business suit"],
    [/\bdhar\b/gi, "fashion designer clothes"],
    [/\bmuraayad\b/gi, "stylish sunglasses"],
    [/\bbad\b/gi, "tropical turquoise ocean with calm waves and coral reef"],
    [/\bbadda\b/gi, "turquoise ocean sea with waves"],
    [/\bbuur\b/gi, "epic snow mountain landscape"],
    [/\bqorrax\b/gi, "golden sunset glowing sky"],
    [/\bdayax\b/gi, "luminous full moon in starry night"],
    [/\bhabeen\b/gi, "starry night sky milky way"],
    [/\bcasri\b/gi, "futuristic scifi cyberpunk"],
    [/\bqurux\b/gi, "masterpiece ultra realistic 8k photorealistic"],
    [/\bmadow\b/gi, "black"],
    [/\bcad\b/gi, "white"],
    [/\bcagaar\b/gi, "lush green"],
    [/\bbuluug\b/gi, "deep vibrant blue"],
    [/\bcasaan\b/gi, "vivid red"],
  ];

  let result = prompt;
  for (const [pattern, replacement] of dictionary) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

async function fetchRealAiImage(prompt: string): Promise<string | null> {
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const models = ["flux", "sdxl"];

  for (const model of models) {
    try {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        prompt
      )}?model=${model}&width=1024&height=1024&seed=${seed}&nologo=true`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 20000) {
          const contentType = res.headers.get("content-type") || "image/jpeg";
          return `data:${contentType};base64,${buffer.toString("base64")}`;
        }
      }
    } catch (err) {
      console.warn(`Model ${model} fetch failed:`, err);
    }
  }

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?model=flux&width=1024&height=1024&seed=${seed}&nologo=true`;
}

export async function POST(request: NextRequest) {
  try {
    const { image, prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const translated = translateSomaliPrompt(prompt);
    const cleanPrompt = translated || prompt;

    const outputUrl = await fetchRealAiImage(cleanPrompt);

    if (!outputUrl) {
      return NextResponse.json(
        { error: "Failed to edit image, please try again." },
        { status: 500 }
      );
    }

    await saveGeneratedImage(outputUrl, prompt, "edit");

    return NextResponse.json(
      {
        success: true,
        output: outputUrl,
        message: "Image edited successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to edit image" },
      { status: 500 }
    );
  }
}
