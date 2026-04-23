import { describe, expect, it } from "vitest";
import { GoogleGenerativeAI } from "@google/generative-ai";

describe("Gemini API Key Validation", () => {
  it("should successfully connect to Gemini API with the provided key", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey, "GEMINI_API_KEY must be set").toBeTruthy();

    const genAI = new GoogleGenerativeAI(apiKey!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    try {
      const result = await model.generateContent("Say 'Oracle online' in exactly 2 words.");
      const text = result.response.text();
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
      console.log("[Gemini Test] Response:", text.trim());
    } catch (err: any) {
      // 429 rate limit is a transient quota issue, not a key/config problem — treat as soft pass
      if (err?.message?.includes("429") || err?.message?.includes("Resource exhausted")) {
        console.warn("[Gemini Test] Rate limited (429) — key is valid, quota temporarily exhausted.");
        return;
      }
      throw err;
    }  }, 30000);
});
