export type Provider = "groq" | "openai";

export type ModelOption = {
  id: string;
  name: string;
  provider: Provider;
  apiModel: string;
  color: "blue" | "pink" | "green" | "violet";
  descriptor: string;
};

export const models: ModelOption[] = [
  {
    id: "groq:gpt-oss-20b",
    name: "GPT-OSS 20B",
    provider: "groq",
    apiModel: "openai/gpt-oss-20b",
    color: "blue",
    descriptor: "Reasoning · Groq",
  },
  {
    id: "groq:llama-3.3-70b",
    name: "Llama 3.3 70B",
    provider: "groq",
    apiModel: "llama-3.3-70b-versatile",
    color: "pink",
    descriptor: "Open model · Groq",
  },
  {
    id: "openai:gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "openai",
    apiModel: "gpt-4o-mini",
    color: "green",
    descriptor: "Fast · OpenAI",
  },
  {
    id: "openai:gpt-4.1-mini",
    name: "GPT-4.1 mini",
    provider: "openai",
    apiModel: "gpt-4.1-mini",
    color: "violet",
    descriptor: "Code · OpenAI",
  },
];

export function getModel(id: string): ModelOption | undefined {
  return models.find((model) => model.id === id);
}
