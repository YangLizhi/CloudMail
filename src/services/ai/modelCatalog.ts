import { getSetting, setSetting } from "@/services/db/settings";
import {
  MODEL_CACHE_KEYS,
  MODEL_SETTINGS,
  PROVIDER_MODELS,
  DEFAULT_MODELS,
  type AiProvider,
  type ModelInfo,
} from "./types";

interface ModelCache {
  at: number;
  models: ModelInfo[];
}

export async function getModelCache(provider: AiProvider): Promise<ModelInfo[] | null> {
  const raw = await getSetting(MODEL_CACHE_KEYS[provider]);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ModelCache;
    if (Array.isArray(parsed.models)) return parsed.models;
  } catch {
    // ignore malformed cache
  }
  return null;
}

export async function setModelCache(
  provider: AiProvider,
  models: ModelInfo[],
): Promise<void> {
  const cache: ModelCache = { at: Date.now(), models };
  await setSetting(MODEL_CACHE_KEYS[provider], JSON.stringify(cache));
}

export async function clearModelCache(provider: AiProvider): Promise<void> {
  await setSetting(MODEL_CACHE_KEYS[provider], "");
}

/**
 * Models for a provider: probed cache first, then the built-in static list.
 */
export async function getModelsForProvider(
  provider: AiProvider,
): Promise<{ models: ModelInfo[]; source: "cache" | "static" }> {
  const cached = await getModelCache(provider);
  if (cached && cached.length > 0) {
    return { models: cached, source: "cache" };
  }
  const staticModels: ModelInfo[] =
    provider === "ollama"
      ? []
      : PROVIDER_MODELS[provider].map((m) => ({ id: m.id, name: m.label }));
  return { models: staticModels, source: "static" };
}

/**
 * Current default model for a provider (falls back to DEFAULT_MODELS).
 */
export async function getProviderDefaultModel(provider: AiProvider): Promise<string> {
  if (provider === "ollama") {
    return (await getSetting("ollama_model")) ?? "llama3.2";
  }
  const key = MODEL_SETTINGS[provider];
  const value = await getSetting(key);
  if (value) return value;
  return DEFAULT_MODELS[provider];
}
