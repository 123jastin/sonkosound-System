import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size limit since we will be sending base64 images from the camera
  app.use(express.json({ limit: "20mb" }));

  // API routes FIRST
  app.post("/api/ocr", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image data provided" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured on the server." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64Data,
        },
      };

      const prompt = "Uchambuzi wa Mwandiko wa Kitabu cha Madeni: Changanua picha hii ya karatasi iliyoandikwa kwa mkono au iliyochapishwa inayoelezea deni, mteja au muuzaji. Chopoa maelezo yafuatayo: Jina la mtu/msambazaji/mteja, namba ya simu ya mkononi, kiasi cha deni (namba pekee), maelezo ya bidhaa zilizokopwa/huduma, na notes zingine za ziada. Hakikisha unarudisha JSON kulingana na schema.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [imagePart, { text: prompt }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "Jina la mtu, mteja au muuzaji/msambazaji (itasaidika likisafishwa na kuanza na herufi kubwa, mfano: Ally Juma)",
              },
              number: {
                type: Type.STRING,
                description: "Namba ya simu ya mhusika kama ipo. Isafishe iwe namba halali ya simu mfano: 0712345678. Kama haipo, weka tupu.",
              },
              deni: {
                type: Type.NUMBER,
                description: "Kiasi cha deni au kiasi cha pesa kilichoandikwa. Kama hakuna au haieleweki, weka 0.",
              },
              maelezo_ya_bidhaa: {
                type: Type.STRING,
                description: "Maelezo ya bidhaa, mzigo au huduma inayohusiana (optional, weka tupu au maelezo mafupi)",
              },
              notes: {
                type: Type.STRING,
                description: "Notes zingine za ziada zilizopo kwenye karatasi (optional, weka tupu kama hakuna)",
              },
            },
            required: ["name", "number", "deni"],
          },
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No text returned from Gemini API");
      }

      const parsed = JSON.parse(resultText.trim());
      res.json({ success: true, data: parsed });

    } catch (error: any) {
      console.error("Gemini OCR Error:", error);
      res.status(500).json({ error: error.message || "Failed to process image with AI" });
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
