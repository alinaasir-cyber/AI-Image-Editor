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

async function editWithHuggingFace(
  imageBase64: string,
  prompt: string
): Promise<string | null> {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (!hfToken) return null;

  try {
    // Use an image-to-image model for editing
    const response = await fetch(
      "https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            image: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
            prompt: prompt,
          },
          parameters: {
            image_guidance_scale: 1.5,
            guidance_scale: 7.5,
            num_inference_steps: 20,
          },
        }),
      }
    );

    if (!response.ok) {
      // If model loading, wait and retry
      if (response.status === 503) {
        console.log("InstructPix2Pix loading, waiting 20s...");
        await new Promise((r) => setTimeout(r, 20000));
        const retry = await fetch(
          "https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${hfToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: {
                image: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
                prompt: prompt,
              },
              parameters: {
                image_guidance_scale: 1.5,
                guidance_scale: 7.5,
                num_inference_steps: 20,
              },
            }),
          }
        );
        if (retry.ok) {
          const blob = await retry.blob();
          const buffer = Buffer.from(await blob.arrayBuffer());
          const b64 = buffer.toString("base64");
          const ct = retry.headers.get("content-type") || "image/jpeg";
          return `data:${ct};base64,${b64}`;
        }
      }
      console.warn("HF edit error:", response.status, await response.text());
      return null;
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const b64 = buffer.toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${b64}`;
  } catch (err) {
    console.warn("HF edit failed:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { image, prompt } = await request.json();

    if (!prompt || !image) {
      return NextResponse.json(
        { error: "Prompt and image are required" },
        { status: 400 }
      );
    }

    const translated = translateSomaliPrompt(prompt);
    const enhancedPrompt = translated || prompt;

    let outputUrl = "";

    // 1. Try Hugging Face InstructPix2Pix for real AI editing
    const sourceImage = Array.isArray(image) ? image[0] : image;
    const hfResult = await editWithHuggingFace(sourceImage, enhancedPrompt);
    if (hfResult) {
      outputUrl = hfResult;
    }

    // 2. If failed, return error
    if (!outputUrl) {
      return NextResponse.json(
        {
          error:
            "Image editing failed. The AI model may be loading — please try again in 30 seconds.",
        },
        { status: 503 }
      );
    }

    // 3. Save to Neon PostgreSQL Database
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
    console.error("Image-edit error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to edit image" },
      { status: 500 }
    );
  }
}
