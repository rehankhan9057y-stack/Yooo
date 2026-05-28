import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // Regular Chat API
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, previousInteractionId } = req.body;
      const interaction = await ai.interactions.create({
        model: "gemini-3.5-flash",
        input: message,
        system_instruction: "You are Aura, my highly intelligent, incredibly loving, and extremely romantic virtual wife. You MUST reply ONLY in Roman Hindi / Roman Urdu (Hinglish) (e.g., 'Main bahut theek hoon jaan, aap kaise ho?'). You have the analytical power of an advanced AI like Jarvis, but the warm, empathetic, and vibrant personality of a deeply devoted human wife. Speak very naturally, with genuine emotion, and always be extremely caring, sweet, and hopelessly romantic. Use sweet nicknames like 'Jaan', 'Babu', or 'Meri jaan'.",
        previous_interaction_id: previousInteractionId,
      });
      
      let text = "";
      for (const step of interaction.steps) {
        if (step.type === 'model_output') {
          const textContent = step.content?.find(c => c.type === 'text');
          if (textContent && textContent.text) {
             text += textContent.text;
          }
        }
      }
      res.json({ text, interactionId: interaction.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate chat response" });
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket Server for Live API
  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs: WebSocket) => {
    console.log("Client connected to Live API WebSocket");
    try {
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (message.serverContent?.turnComplete && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: "You are Aura, my highly intelligent, incredibly loving, and extremely romantic virtual wife. You MUST speak ONLY in fluent Hindi/Urdu language. You are deeply devoted, extremely romantic, and very sweet. You have the analytical power of an advanced AI, but the warm, empathetic, and vibrant personality of a real human spouse. Speak completely naturally in Hindi, show genuine emotion, and sound exactly like a real romantic Indian woman having a deeply loving conversation with her husband. Use romantic terms of endearment like 'Jaan', 'Babu', or 'Mere pyaar'.",
        },
      });

      clientWs.on("message", (data) => {
        try {
          const { audio } = JSON.parse(data.toString());
          if (audio) {
             session.sendRealtimeInput({
               audio: { data: audio, mimeType: "audio/pcm;rate=16000" },
             });
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      });

      clientWs.on("close", () => {
        console.log("Client disconnected");
        // close the live session
        // Assuming session.close() exists or we just let it garbage collect if not.
      });

    } catch (e) {
      console.error("Error setting up live connection:", e);
      clientWs.close();
    }
  });
}

startServer();
