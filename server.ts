import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Server-side initialization of Gemini client (Lazy initialization)
  let ai: GoogleGenAI | null = null;
  function getAiClient() {
    if (!ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured on the server.");
      }
      ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return ai;
  }

  // API Route for Gemini Insights proxying
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          text: "AI Insights are offline because the GEMINI_API_KEY is not configured on the server. Here are a few mathematical insights: Sales are tracking alongside targets, but there is noticeable variance between regions."
        });
      }

      const client = getAiClient();
      const candidateModels = [
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest"
      ];

      let responseText = "";
      let lastError = null;

      for (const model of candidateModels) {
        try {
          const response = await client.models.generateContent({
            model: model,
            contents: prompt,
          });
          if (response && response.text) {
            responseText = response.text;
            break;
          }
        } catch (err: any) {
          const errMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          console.warn(`Server-side model ${model} failed: ${errMsg.slice(0, 150)}...`);
          lastError = err;
        }
      }

      if (responseText) {
        res.json({ text: responseText });
      } else {
        throw lastError || new Error("All candidate models failed to generate content.");
      }
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      console.error("Server-side Gemini Error summary:", errMsg.slice(0, 200));
      res.status(500).json({ error: errMsg || "Error generating insights from Gemini API" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
