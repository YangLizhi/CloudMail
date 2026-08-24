export type SkillRisk = "read" | "write" | "network";

export interface Skill {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  instructions: string;
  tools: string[];
  risk: SkillRisk;
  builtin: boolean;
  enabled: boolean;
  installedAt?: number;
  sourceUrl?: string;
}
