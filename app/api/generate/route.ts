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

async function generateWithHuggingFace(prompt: string): Promise<string | null> {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (!hfToken) return null;

  // Try FLUX.1-schnell first (fast, high quality)
  const models = [
    "black-forest-labs/FLUX.1-schnell",
    "stabilityai/stable-diffusion-xl-base-1.0",
  ];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              num_inference_steps: model.includes("FLUX") ? 4 : 30,
              guidance_scale: model.includes("FLUX") ? 0 : 7.5,
              width: 1024,
              height: 1024,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`HF model ${model} error:`, response.status, errorText);
        // If model is loading, wait and retry once
        if (response.status === 503) {
          console.log(`Model ${model} is loading, waiting 20s...`);
          await new Promise((r) => setTimeout(r, 20000));
          const retry = await fetch(
            `https://api-inference.huggingface.co/models/${model}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${hfToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                inputs: prompt,
                parameters: {
                  num_inference_steps: model.includes("FLUX") ? 4 : 30,
                  guidance_scale: model.includes("FLUX") ? 0 : 7.5,
                  width: 1024,
                  height: 1024,
                },
              }),
            }
          );
          if (retry.ok) {
            const blob = await retry.blob();
            const buffer = Buffer.from(await blob.arrayBuffer());
            const base64 = buffer.toString("base64");
            const contentType = retry.headers.get("content-type") || "image/jpeg";
            return `data:${contentType};base64,${base64}`;
          }
        }
        continue;
      }

      const blob = await response.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());
      const base64 = buffer.toString("base64");
      const contentType = response.headers.get("content-type") || "image/jpeg";
      return `data:${contentType};base64,${base64}`;
    } catch (err) {
      console.warn(`HF model ${model} failed:`, err);
      continue;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Enhance the prompt for better results
    const translated = translateSomaliPrompt(prompt);
    const enhancedPrompt = translated || prompt;

    let outputUrl = "";

    // 1. Try Hugging Face AI image generation
    const hfResult = await generateWithHuggingFace(enhancedPrompt);
    if (hfResult) {
      outputUrl = hfResult;
    }

    // 2. If HF failed, return error (no more fake image search)
    if (!outputUrl) {
      return NextResponse.json(
        {
          error:
            "Image generation failed. The AI model may be loading — please try again in 30 seconds.",
        },
        { status: 503 }
      );
    }

    // 3. Save to Neon PostgreSQL Database
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
      { status: 500 },
    );
  }
}
