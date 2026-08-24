import {
  getAiSetting,
  getSecureAiSetting,
} from "./aiConfigStore";
import { AiError } from "./errors";
import type { AiProvider, AiProviderClient, ModelInfo } from "./types";
import { DEFAULT_MODELS, MODEL_SETTINGS } from "./types";
import { createClaudeProvider, clearClaudeProvider } from "./providers/claudeProvider";
import { createOpenAIProvider, clearOpenAIProvider } from "./providers/openaiProvider";
import { createGeminiProvider, clearGeminiProvider } from "./providers/geminiProvider";
import { createOllamaProvider, clearOllamaProvider } from "./providers/ollamaProvider";
import { createCopilotProvider, clearCopilotProvider } from "./providers/copilotProvider";
import { createCustomProvider, clearCustomProvider } from "./providers/customProvider";

const API_KEY_SETTINGS: Record<Exclude<AiProvider, "ollama">, string> = {
  claude: "claude_api_key",
  openai: "openai_api_key",
  gemini: "gemini_api_key",
  copilot: "copilot_api_key",
  custom: "custom_api_key",
};

let cachedProvider: { name: AiProvider; key: string; client: AiProviderClient } | null = null;

export async function getActiveProviderName(): Promise<AiProvider> {
  const setting = await getAiSetting("ai_provider");
  if (setting === "openai" || setting === "gemini" || setting === "ollama" || setting === "copilot" || setting === "custom") return setting;
  return "claude";
}

export async function getActiveProvider(
  overrideModel?: string,
): Promise<AiProviderClient> {
  const providerName = await getActiveProviderName();

  if (providerName === "ollama") {
    const serverUrl = (await getAiSetting("ollama_server_url")) ?? "http://localhost:11434";
    const model =
      overrideModel ??
      ((await getAiSetting("ollama_model")) ?? "llama3.2");
    const cacheKey = `${serverUrl}|${model}`;

    if (cachedProvider && cachedProvider.name === "ollama" && cachedProvider.key === cacheKey) {
      return cachedProvider.client;
    }

    const client = createOllamaProvider(serverUrl, model);
    cachedProvider = { name: "ollama", key: cacheKey, client };
    return client;
  }

  if (providerName === "custom") {
    const baseUrl = (await getAiSetting("custom_base_url"))?.trim().replace(/[，,]+$/u, "");
    const apiKey = await getSecureAiSetting("custom_api_key");
    const model =
      overrideModel ??
      ((await getAiSetting("custom_model")) ?? DEFAULT_MODELS.custom);

    if (!baseUrl) {
      throw new AiError("NOT_CONFIGURED", "Custom AI base URL not configured");
    }

    const cacheKey = `${baseUrl}|${apiKey ?? ""}|${model}`;
    if (cachedProvider && cachedProvider.name === "custom" && cachedProvider.key === cacheKey) {
      return cachedProvider.client;
    }

    const client = createCustomProvider(baseUrl, apiKey ?? "", model);
    cachedProvider = { name: "custom", key: cacheKey, client };
    return client;
  }

  const keySetting = API_KEY_SETTINGS[providerName];
  const apiKey = await getSecureAiSetting(keySetting);

  if (!apiKey) {
    throw new AiError("NOT_CONFIGURED", `${providerName} API key not configured`);
  }

  const model =
    overrideModel ??
    ((await getAiSetting(MODEL_SETTINGS[providerName])) ??
      DEFAULT_MODELS[providerName]);
  const cacheKey = `${apiKey}|${model}`;

  if (cachedProvider && cachedProvider.name === providerName && cachedProvider.key === cacheKey) {
    return cachedProvider.client;
  }

  let client: AiProviderClient;
  switch (providerName) {
    case "claude":
      client = createClaudeProvider(apiKey, model);
      break;
    case "openai":
      client = createOpenAIProvider(apiKey, model);
      break;
    case "gemini":
      client = createGeminiProvider(apiKey, model);
      break;
    case "copilot":
      client = createCopilotProvider(apiKey, model);
      break;
  }

  cachedProvider = { name: providerName, key: cacheKey, client };
  return client;
}

/**
 * List available models for the active provider (with optional model override).
 * Returns [] when the endpoint does not support model listing.
 */
export async function listModels(overrideModel?: string): Promise<ModelInfo[]> {
  const provider = await getActiveProvider(overrideModel);
  return provider.listModels();
}

export async function isAiAvailable(): Promise<boolean> {
  try {
    const enabled = await getAiSetting("ai_enabled");
    if (enabled === "false") return false;
    const providerName = await getActiveProviderName();

    if (providerName === "ollama") {
      const serverUrl = await getAiSetting("ollama_server_url");
      return !!serverUrl;
    }

    if (providerName === "custom") {
      const baseUrl = (await getAiSetting("custom_base_url"))?.trim().replace(/[，,]+$/u, "");
      const key = await getSecureAiSetting("custom_api_key");
      return !!baseUrl && !!key;
    }

    const keySetting = API_KEY_SETTINGS[providerName];
    const key = await getSecureAiSetting(keySetting);
    return !!key;
  } catch {
    return false;
  }
}

export function clearProviderClients(): void {
  cachedProvider = null;
  clearClaudeProvider();
  clearOpenAIProvider();
  clearGeminiProvider();
  clearOllamaProvider();
  clearCopilotProvider();
  clearCustomProvider();
}
