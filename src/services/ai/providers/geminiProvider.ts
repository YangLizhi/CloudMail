import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiProviderClient, AiCompletionRequest, ModelInfo } from "../types";
import { createProviderFactory } from "../providerFactory";

const factory = createProviderFactory(
  (apiKey) => new GoogleGenerativeAI(apiKey),
);

export function createGeminiProvider(apiKey: string, modelId: string): AiProviderClient {
  const client = factory.getClient(apiKey);

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: req.systemPrompt,
      });

      const result = await model.generateContent(req.userContent);
      return result.response.text();
    },

    async testConnection(): Promise<boolean> {
      try {
        const model = client.getGenerativeModel({
          model: modelId,
        });
        await model.generateContent("Say hi");
        return true;
      } catch {
        return false;
      }
    },

    async listModels(): Promise<ModelInfo[]> {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        );
        if (!res.ok) return [];
        const payload = (await res.json()) as {
          models?: {
            name?: string;
            displayName?: string;
            supportedGenerationMethods?: string[];
          }[];
        };
        return (payload.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m) => ({
            id: (m.name ?? "").replace(/^models\//, ""),
            name: m.displayName ?? (m.name ?? "").replace(/^models\//, ""),
          }))
          .filter((m) => m.id.length > 0);
      } catch {
        return [];
      }
    },
  };
}

export function clearGeminiProvider(): void {
  factory.clear();
}
