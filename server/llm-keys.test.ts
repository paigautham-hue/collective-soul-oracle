import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

describe("Anthropic API Key Validation", () => {
  it("should successfully connect to Claude API with the provided key", async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    expect(apiKey, "ANTHROPIC_API_KEY must be set").toBeTruthy();

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 16,
      messages: [{ role: "user", content: "Say 'Oracle online' in exactly 2 words." }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log("[Claude Test] Response:", text.trim());
  }, 30000);
});

describe("OpenAI API Key Validation", () => {
  it("should successfully connect to OpenAI API with the provided key", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey, "OPENAI_API_KEY must be set").toBeTruthy();

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 16,
      messages: [{ role: "user", content: "Say 'Oracle online' in exactly 2 words." }],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log("[OpenAI Test] Response:", text.trim());
  }, 30000);
});
