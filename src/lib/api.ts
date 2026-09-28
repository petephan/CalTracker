import Constants from "expo-constants";
import { supabase } from "./supabase";
import type { Analysis } from "./types";

const SERVER_PORT = 8787;

/**
 * In development the app is served from your laptop, so the analysis server is on the
 * same host as Metro. Works for the simulator (localhost) and a phone on the same Wi-Fi.
 */
export function defaultServerUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
  return `http://${host}:${SERVER_PORT}`;
}

export class AnalysisError extends Error {}

export async function analyzeFood(serverUrl: string, imageBase64: string): Promise<Analysis> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    // The server only analyzes photos for signed-in users, and rate-limits each one.
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`${serverUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ image: imageBase64, mediaType: "image/jpeg" }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new AnalysisError(typeof body?.error === "string" ? body.error : `Server error (${res.status})`);
    if (!isAnalysis(body)) throw new AnalysisError("Got an unexpected response from the analysis server.");
    return body;
  } catch (e) {
    if (e instanceof AnalysisError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new AnalysisError("The analysis took too long. Try again.");
    throw new AnalysisError(`Can't reach the analysis server at ${serverUrl}. Is it running? (npm run server)`);
  } finally {
    clearTimeout(timer);
  }
}

export async function checkServer(serverUrl: string): Promise<{ ok: boolean; demo?: boolean; model?: string }> {
  try {
    const res = await fetch(`${serverUrl}/health`);
    return (await res.json()) as { ok: boolean; demo: boolean; model: string };
  } catch {
    return { ok: false };
  }
}

const MACROS = ["calories", "protein", "carbs", "fat"] as const;
const isMacros = (v: any) => MACROS.every((k) => typeof v?.[k] === "number" && Number.isFinite(v[k]) && v[k] >= 0);

/** The server URL can be changed in Settings, so check the reply's shape before it's saved as a meal. */
function isAnalysis(v: any): v is Analysis {
  return (
    typeof v?.is_food === "boolean" &&
    typeof v.name === "string" &&
    isMacros(v) &&
    Array.isArray(v.items) &&
    v.items.every((it: any) => typeof it?.name === "string" && typeof it.portion === "string" && isMacros(it)) &&
    ["low", "medium", "high"].includes(v.confidence) &&
    typeof v.health_score === "number" &&
    typeof v.note === "string"
  );
}
