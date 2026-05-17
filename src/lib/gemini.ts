import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY is missing. AI Insights will be simulated.");
      // Just returning a mock or we can throw. Let's not throw so it works without key locally.
      return new GoogleGenAI({ apiKey: "mock" }); // Will fail on call, but we can catch it.
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export async function generateInsights(prompt: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "AI Insights are offline because the GEMINI_API_KEY is not configured. Here are a few mathematical insights: Sales are tracking alongside targets, but there is noticeable variance between regions.";
  }
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });
    return response.text || "No insights generated.";
  } catch (err) {
    console.error("Gemini AI Array:", err);
    return "Error communicating with AI service. Please check your API key or network connection.";
  }
}
