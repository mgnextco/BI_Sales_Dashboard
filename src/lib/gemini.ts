export function compileLocalInsights(prompt: string): string {
  // Extract values using regex
  const totalSalesMatch = prompt.match(/Total Sales:\s*([0-9.,\-]+)/i);
  const achievementMatch = prompt.match(/Achievement:\s*([0-9.,\-]+)%/i);
  const growthMatch = prompt.match(/Growth vs Past Year:\s*([0-9.,\-]+)%/i);
  const topRegionMatch = prompt.match(/Top Region:\s*([^\n\r]+)/i);
  const topBUMatch = prompt.match(/Top BU:\s*([^\n\r]+)/i);
  const topBrandMatch = prompt.match(/Top Brand:\s*([^\n\r]+)/i);

  // Parse or default values
  const salesVal = totalSalesMatch ? parseFloat(totalSalesMatch[1].replace(/,/g, '')) : 0;
  const achievementVal = achievementMatch ? parseFloat(achievementMatch[1]) : 100;
  const growthVal = growthMatch ? parseFloat(growthMatch[1]) : 0;
  const region = topRegionMatch ? topRegionMatch[1].trim() : "Europe/West";
  const bu = topBUMatch ? topBUMatch[1].trim() : "General Medicines";
  const brand = topBrandMatch ? topBrandMatch[1].trim() : "Core Brand";

  // Format sales nicely
  const formatNum = (num: number) => {
    if (num >= 1.0e9) return (num / 1.0e9).toFixed(1) + "B";
    if (num >= 1.0e6) return (num / 1.0e6).toFixed(1) + "M";
    if (num >= 1.0e3) return (num / 1.0e3).toFixed(1) + "K";
    return num.toLocaleString();
  };

  const formattedSales = salesVal > 0 ? formatNum(salesVal) : "the current portfolio";
  const isGrowthPositive = growthVal >= 0;

  return `### Executive Commercial Performance Brief

Based on the latest automated business intelligence telemetry, our consolidated commercial performance represents a solid baseline with total actual sales standing at **${formattedSales}**, achieving **${achievementVal.toFixed(1)}%** of the strategic target. Year-over-year revenue comparison reflects a **${isGrowthPositive ? 'positive expansion of +' : 'moderate contraction of -'}${Math.abs(growthVal).toFixed(1)}%**, highlighting ${isGrowthPositive ? 'favorable market expansion' : 'ongoing localized macroeconomic challenges'}.

### Key Portfolio Drivers
- **Regional Superformer**: **${region}** leads global commercial contribution, acting as our most vital territorial segment and demonstrating strong customer pull.
- **Line Leaders**: The **${bu}** Business Unit and our high-yielding brand **${brand}** remain the primary commercial engines, anchoring our volume expansion.
- **Performance Momentum**: Target compliance at **${achievementVal.toFixed(1)}%** suggests operational resilience, though minor inefficiencies persist in secondary markets.

### Strategic Risks & Mitigations
- **Single-Brand Exposure**: Excessive dependency on **${brand}** sales creates vulnerability. We must cross-promote other high-margin business lines to diversify exposure.
- **Regional Dispersal**: Performance gaps between **${region}** and trailing territories indicate a need to optimize field-force allocation and align localized commercial campaigns.

### Tactical Next Steps
1. **Target Redistribution**: Rebalance territorial expectations dynamically to favor high-growth clusters while alleviating pressure on supply-constrained areas.
2. **Launch Extension**: Scale best practices from the **${bu}** Business Unit to accelerate secondary brand penetration.
3. **Continuous Grounding**: Maintain high-precision tracking of sales-to-target variances to adjust commercial campaigns in real time.

*(Running in static client-side mode. Real-time custom AI insights can be unlocked by setting your personal Gemini API key in the dashboard settings.)*`;
}

export async function generateInsights(prompt: string): Promise<string> {
  // 1. Try server-side API proxy first
  try {
    const response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });
    
    // If the server route is configured and succeeds, return its response
    if (response.ok) {
      const data = await response.json();
      if (data.text) {
        return data.text;
      }
    } else {
      console.warn(`Express backend server returned status ${response.status}. Falling back to client-side execution.`);
      return await executeClientFallback(prompt);
    }
  } catch (err: any) {
    console.warn("Failed to contact server API. Falling back to client-side execution/local compiler.", err);
  }

  // 2. Client-side execution fallback
  return await executeClientFallback(prompt);
}

async function executeClientFallback(prompt: string): Promise<string> {
  try {
    let clientKey = "";
    try {
      clientKey = localStorage.getItem("USER_GEMINI_API_KEY") || "";
    } catch (e) {
      console.warn("localStorage is not accessible:", e);
    }

    if (!clientKey) {
      try {
        clientKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
      } catch (e) {
        console.warn("import.meta.env is not accessible:", e);
      }
    }

    // Try browser-integrated local Gemini Nano first if no custom key is provided
    if (!clientKey && typeof window !== "undefined") {
      const win = window as any;
      if (win.ai) {
        try {
          if (win.ai.languageModel) {
            const capabilities = await win.ai.languageModel.capabilities();
            if (capabilities.available !== "no") {
              const session = await win.ai.languageModel.create();
              const responseText = await session.prompt(prompt);
              if (responseText) {
                return `### Generated via Chrome Built-in AI (Gemini Nano)\n\n${responseText}`;
              }
            }
          } else if (win.ai.assistant) {
            const capabilities = await win.ai.assistant.capabilities();
            if (capabilities.available !== "no") {
              const session = await win.ai.assistant.create();
              const responseText = await session.prompt(prompt);
              if (responseText) {
                return `### Generated via Chrome Built-in AI (Gemini Nano - Legacy API)\n\n${responseText}`;
              }
            }
          }
        } catch (nanoErr: any) {
          console.warn("Chrome local window.ai failed, falling back to compiled engine:", nanoErr);
        }
      }
    }
    
    if (clientKey && clientKey.trim().length > 10) {
      try {
        // Dynamically import @google/genai to prevent inflating the initial bundle size
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: clientKey });
        
        const candidateModels = [
          "gemini-3.5-flash",
          "gemini-3.1-flash-lite",
          "gemini-flash-latest"
        ];

        let clientResponseText = "";
        let lastClientError = null;

        for (const model of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: model,
              contents: prompt,
            });
            if (response && response.text) {
              clientResponseText = response.text;
              break;
            }
          } catch (modelErr: any) {
            console.warn(`Client-side model ${model} failed:`, modelErr?.message || modelErr);
            lastClientError = modelErr;
          }
        }

        if (clientResponseText) {
          return clientResponseText;
        } else {
          throw lastClientError || new Error("All client candidate models failed.");
        }
      } catch (clientErr: any) {
        console.error("Direct client-side Gemini execution failed:", clientErr);
        return `### Client-Side Gemini Generation Failed\n\nError: ${clientErr.message || clientErr}\n\nFalling back to compiled telemetry analytics:\n\n${compileLocalInsights(prompt)}`;
      }
    }
  } catch (err: any) {
    console.error("Error in executeClientFallback wrapper:", err);
  }

  // 3. Perfect mathematical compiler fallback if no key is configured or direct fallback fails
  return compileLocalInsights(prompt);
}
