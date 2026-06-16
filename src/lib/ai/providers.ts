export type AIProvider = "openai" | "anthropic" | "xai" | "gemini";

export const AI_PROVIDERS: { value: AIProvider; label: string; hint: string }[] = [
  { value: "xai",       label: "xAI (Grok)",           hint: "api.x.ai" },
  { value: "openai",    label: "OpenAI (GPT-4o)",       hint: "platform.openai.com" },
  { value: "anthropic", label: "Anthropic (Claude)",    hint: "console.anthropic.com" },
  { value: "gemini",    label: "Google (Gemini Flash)",  hint: "aistudio.google.com" },
];

export interface SavedKeyInfo {
  provider: AIProvider;
  keyHint: string | null;
  isSelected: boolean;
}
