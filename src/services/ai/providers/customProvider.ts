import OpenAI from "openai";
import { fetch } from "@tauri-apps/plugin-http";
import type { AiProviderClient, AiCompletionRequest, ModelInfo } from "../types";
import { appendDebugLog } from "@/services/debugLog";

let instance: OpenAI | null = null;
let cachedKey: string | null = null;

function getClient(baseUrl: string, apiKey: string): OpenAI {
  const trimmed = baseUrl.trim().replace(/[，,]+$/u, "").replace(/\/+$/, "");
  const normalizedBaseUrl = /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
  const cacheKey = `${normalizedBaseUrl}|${apiKey}`;
  if (!instance || cachedKey !== cacheKey) {
    instance = new OpenAI({
      baseURL: normalizedBaseUrl,
      apiKey: apiKey || "custom",
      dangerouslyAllowBrowser: true,
      fetch,
    });
    cachedKey = cacheKey;
  }
  return instance;
}

export function createCustomProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
): AiProviderClient {
  const client = getClient(baseUrl, apiKey);

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userContent },
        ],
      });

      return response.choices[0]?.message?.content ?? "";
    },

    async testConnection(): Promise<boolean> {
      try {
        await client.chat.completions.create({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Say hi" }],
        });
        return true;
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        let extra = "";
        try {
          extra = JSON.stringify(err, Object.getOwnPropertyNames(err));
        } catch {
          extra = detail;
        }
        await appendDebugLog("error", `custom AI testConnection failed for ${baseUrl}: ${detail} | ${extra}`);
        return false;
      }
    },

    async listModels(): Promise<ModelInfo[]> {
      try {
        const page = await client.models.list();
        return (page.data ?? []).map((m) => ({ id: m.id, name: m.id }));
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        await appendDebugLog("error", `custom AI listModels failed for ${baseUrl}: ${detail}`);
        return [];
      }
    },
  };
}

export function clearCustomProvider(): void {
  instance = null;
  cachedKey = null;
}
