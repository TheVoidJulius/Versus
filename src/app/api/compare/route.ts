import { NextResponse } from "next/server";
import { getModel, type ModelOption } from "@/data/models";
import { makeDemoResponse } from "@/lib/demo";

export const runtime = "nodejs";

type ModelResult = {
  modelId: string;
  text?: string;
  error?: string;
  elapsedMs: number;
  mode: "live" | "demo";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isModelIdPair(value: unknown): value is [string, string] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === "string"
    && typeof value[1] === "string";
}

function extractText(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;
  const firstChoice: unknown = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  return typeof firstChoice.message.content === "string" ? firstChoice.message.content : null;
}

async function compareWithModel(prompt: string, model: ModelOption): Promise<ModelResult> {
  const start = Date.now();
  const apiKey = model.provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      modelId: model.id,
      text: makeDemoResponse(prompt, model),
      elapsedMs: Date.now() - start,
      mode: "demo",
    };
  }

  const endpoint = model.provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model.apiModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_completion_tokens: 1200,
      }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        modelId: model.id,
        error: `${model.provider === "groq" ? "Groq" : "OpenAI"} returned HTTP ${response.status}. Check the model, key, and provider limits.`,
        elapsedMs: Date.now() - start,
        mode: "live",
      };
    }

    const payload: unknown = await response.json();
    const text = extractText(payload);
    if (!text) {
      return {
        modelId: model.id,
        error: "The provider returned an empty or unrecognized response.",
        elapsedMs: Date.now() - start,
        mode: "live",
      };
    }
    return { modelId: model.id, text, elapsedMs: Date.now() - start, mode: "live" };
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "The request timed out after 45 seconds."
      : "Could not reach the provider. Check your connection and try again.";
    return { modelId: model.id, error: message, elapsedMs: Date.now() - start, mode: "live" };
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  if (typeof payload.prompt !== "string" || payload.prompt.trim().length === 0 || payload.prompt.length > 5_000) {
    return NextResponse.json({ error: "Enter a prompt between 1 and 5,000 characters." }, { status: 400 });
  }
  if (!isModelIdPair(payload.modelIds)) {
    return NextResponse.json({ error: "Choose exactly two models to compare." }, { status: 400 });
  }

  const prompt = payload.prompt.trim();
  const firstModel = getModel(payload.modelIds[0]);
  const secondModel = getModel(payload.modelIds[1]);
  if (!firstModel || !secondModel) {
    return NextResponse.json({ error: "One or more selected models are unavailable." }, { status: 400 });
  }

  const results = await Promise.all([
    compareWithModel(prompt, firstModel),
    compareWithModel(prompt, secondModel),
  ]);
  return NextResponse.json({ results });
}
