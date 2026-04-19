/**
 * AI Client abstraction — supports Anthropic and IONOS (OpenAI-compatible) providers.
 * Configured via AI_PROVIDER env var. Default: ionos.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getEnv } from "./env";

/* ─── Shared types ──────────────────────────────────────────── */

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatOptions {
  system: string;
  messages: AIChatMessage[];
  maxTokens: number;
  model?: string;
}

export interface AIVisionOptions {
  imageBuffer: Buffer;
  mediaType: "image/png" | "image/jpeg" | "image/gif";
  prompt: string;
  maxTokens: number;
  model?: string;
}

/* ─── Provider clients (lazy singletons) ────────────────────── */

let _anthropic: Anthropic | null = null;
let _ionos: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (_anthropic) return _anthropic;
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  _anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function getIonosClient(): OpenAI {
  if (_ionos) return _ionos;
  const env = getEnv();
  if (!env.IONOS_API_KEY) throw new Error("IONOS_API_KEY not configured");
  _ionos = new OpenAI({ apiKey: env.IONOS_API_KEY, baseURL: env.IONOS_AI_BASE_URL });
  return _ionos;
}

function getActiveModel(): string {
  const env = getEnv();
  return env.AI_PROVIDER === "anthropic" ? env.ANTHROPIC_MODEL : env.IONOS_AI_MODEL;
}

/* ─── Chat completion ───────────────────────────────────────── */

export async function aiChat(options: AIChatOptions): Promise<string> {
  const env = getEnv();
  const model = options.model || getActiveModel();

  if (env.AI_PROVIDER === "anthropic") {
    return anthropicChat(model, options);
  }
  return ionosChat(model, options);
}

async function anthropicChat(model: string, options: AIChatOptions): Promise<string> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens,
    system: options.system,
    messages: options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function ionosChat(model: string, options: AIChatOptions): Promise<string> {
  const client = getIonosClient();
  const response = await client.chat.completions.create({
    model,
    max_tokens: options.maxTokens,
    messages: [
      { role: "system" as const, content: options.system },
      ...options.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });
  return response.choices[0]?.message?.content || "";
}

/* ─── Vision (image → text) ─────────────────────────────────── */

export async function aiVision(options: AIVisionOptions): Promise<string> {
  const env = getEnv();
  const model = options.model || getActiveModel();

  if (env.AI_PROVIDER === "anthropic") {
    return anthropicVision(model, options);
  }
  return ionosVision(model, options);
}

async function anthropicVision(model: string, options: AIVisionOptions): Promise<string> {
  const client = getAnthropicClient();
  const base64 = options.imageBuffer.toString("base64");

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: options.mediaType, data: base64 },
          },
          { type: "text", text: options.prompt },
        ],
      },
    ],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function ionosVision(model: string, options: AIVisionOptions): Promise<string> {
  const client = getIonosClient();
  const base64 = options.imageBuffer.toString("base64");

  const response = await client.chat.completions.create({
    model,
    max_tokens: options.maxTokens,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${options.mediaType};base64,${base64}` },
          },
          { type: "text", text: options.prompt },
        ],
      },
    ],
  });
  return response.choices[0]?.message?.content || "";
}
