// Local nutrition-analysis server. Receives a food photo from the app, asks Claude
// for a calorie + macro estimate, and returns structured JSON.
// Keeps the Anthropic credentials on your laptop instead of inside the app bundle.
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 8787);
const DEMO = process.env.DEMO === "1";
const MODEL = "claude-opus-5";

const client = DEMO ? null : new Anthropic();

// Only signed-in CalSnap users can spend AI credit. Tokens are checked with Supabase; the app's .env supplies these.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!DEMO && (!SUPABASE_URL || !SUPABASE_KEY)) {
  throw new Error("Missing Supabase settings. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the app's .env.");
}
const supabase = DEMO ? null : createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } });

const SCANS_PER_HOUR = Number(process.env.SCANS_PER_HOUR ?? 30);
const recentScans = new Map<string, number[]>(); // user id -> request times in the last hour

/** Rejects requests without a valid Supabase session, and users over their hourly scan limit. Demo mode is free, so it's open. */
async function requireUser(req: http.IncomingMessage): Promise<void> {
  if (!supabase) return;
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Sign in to analyze photos.");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session expired. Sign in again.");

  const now = Date.now();
  const recent = (recentScans.get(data.user.id) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= SCANS_PER_HOUR) throw new HttpError(429, "You've hit the hourly scan limit. Try again later.");
  recentScans.set(data.user.id, [...recent, now]);
}

// Forget users with no scans in the last hour so the map doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, times] of recentScans) if (times.every((t) => t < cutoff)) recentScans.delete(id);
}, 10 * 60 * 1000).unref();

const Item = z.object({
  name: z.string(),
  portion: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const Analysis = z.object({
  is_food: z.boolean(),
  name: z.string(),
  items: z.array(Item),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  health_score: z.number(),
  note: z.string(),
});
type Analysis = z.infer<typeof Analysis>;

const itemSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    portion: { type: "string", description: "Estimated portion, e.g. '1 cup', '150 g'" },
    calories: { type: "number" },
    protein: { type: "number", description: "grams" },
    carbs: { type: "number", description: "grams" },
    fat: { type: "number", description: "grams" },
  },
  required: ["name", "portion", "calories", "protein", "carbs", "fat"],
  additionalProperties: false,
};

const analysisSchema = {
  type: "object",
  properties: {
    is_food: { type: "boolean", description: "false if the photo does not show food or drink" },
    name: { type: "string", description: "Short, appetizing name for the whole meal (max ~5 words)" },
    items: { type: "array", items: itemSchema },
    calories: { type: "number", description: "Total kcal, equal to the sum of items" },
    protein: { type: "number", description: "Total grams" },
    carbs: { type: "number", description: "Total grams" },
    fat: { type: "number", description: "Total grams" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    health_score: { type: "number", description: "1-10 overall nutritional quality" },
    note: { type: "string", description: "One short sentence on assumptions made (hidden oils, sauces, portion size)" },
  },
  required: ["is_food", "name", "items", "calories", "protein", "carbs", "fat", "confidence", "health_score", "note"],
  additionalProperties: false,
};

const SYSTEM = `You are a nutrition analyst inside a calorie-tracking app. The user photographs a meal and you estimate what it contains.

Identify each distinct food or drink, estimate its portion from visual cues (plate size, utensils, hands, packaging), and give calories and macronutrients in grams. Account for cooking oils, dressings, and sauces that are likely present even if not obvious. When unsure between two portion sizes, pick the more likely one and say so in the note. Totals must equal the sum of the items. Round calories to the nearest 5 and grams to whole numbers.

If the image does not show food or drink, set is_food to false, return an empty items list and zeros.`;

const DEMO_RESULT: Analysis = {
  is_food: true,
  name: "Grilled Chicken Bowl",
  items: [
    { name: "Grilled chicken breast", portion: "150 g", calories: 250, protein: 46, carbs: 0, fat: 6 },
    { name: "White rice", portion: "1 cup", calories: 205, protein: 4, carbs: 45, fat: 0 },
    { name: "Avocado", portion: "1/2 fruit", calories: 120, protein: 1, carbs: 6, fat: 11 },
    { name: "Mixed greens + dressing", portion: "1 cup", calories: 70, protein: 1, carbs: 4, fat: 6 },
  ],
  calories: 645,
  protein: 52,
  carbs: 55,
  fat: 23,
  confidence: "high",
  health_score: 8,
  note: "Demo mode: this is a sample result, not an analysis of your photo.",
};

async function analyze(imageBase64: string, mediaType: "image/jpeg" | "image/png"): Promise<Analysis> {
  if (!client) {
    await new Promise((r) => setTimeout(r, 1200));
    return DEMO_RESULT;
  }

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: analysisSchema },
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Estimate the nutrition for this meal." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "The image couldn't be analyzed. Try another photo.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new HttpError(502, "The analysis was cut off. Please try again.");
  }

  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = Analysis.safeParse(JSON.parse(text));
  if (!parsed.success) throw new HttpError(502, "Got an unexpected response from the model.");
  return parsed.data;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:8081";

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    // Native apps ignore CORS; this only lets the Expo web preview in, not any site open in your browser.
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(body));
}

// Check the file's leading bytes, not just the declared type: base64 of FF D8 FF is "/9j/", of 89 50 4E 47 is "iVBORw".
const SIGNATURE = { "image/jpeg": "/9j/", "image/png": "iVBORw" } as const;

const RequestBody = z
  .object({
    image: z.base64().min(100),
    mediaType: z.enum(["image/jpeg", "image/png"]).default("image/jpeg"),
  })
  .refine((b) => b.image.startsWith(SIGNATURE[b.mediaType]), "Image data doesn't match its type.");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, null);
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, demo: DEMO, model: MODEL });
  if (req.method !== "POST" || req.url !== "/analyze") return send(res, 404, { error: "Not found" });

  const started = Date.now();
  try {
    await requireUser(req);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 15 * 1024 * 1024) throw new HttpError(413, "Image too large.");
      chunks.push(chunk);
    }
    const body = RequestBody.safeParse(parseJson(Buffer.concat(chunks).toString("utf8")));
    if (!body.success) throw new HttpError(400, "Expected { image: base64 JPEG or PNG, mediaType }.");

    const result = await analyze(body.data.image, body.data.mediaType);
    console.log(`✓ ${result.name} — ${result.calories} kcal (${Date.now() - started} ms)`);
    send(res, 200, result);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("✗ Anthropic auth failed — set ANTHROPIC_API_KEY or run with `npm run demo`.");
      return send(res, 500, { error: "Server isn't authenticated with Anthropic." });
    }
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: "Too many requests — try again in a moment." });
    if (err instanceof Anthropic.APIError) {
      console.error(`✗ Anthropic API error ${err.status}:`, err.message);
      return send(res, 502, { error: "The AI service had a problem. Try again." });
    }
    console.error("✗", err);
    send(res, 500, { error: "Something went wrong." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CalSnap server on http://0.0.0.0:${PORT} ${DEMO ? "(DEMO mode — no AI calls)" : `(model: ${MODEL})`}`);
});
