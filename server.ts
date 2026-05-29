import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const memoryFile = path.join("/tmp", "memory.json");

function getMemory() {
  if (fs.existsSync(memoryFile)) {
    try {
      return JSON.parse(fs.readFileSync(memoryFile, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function addMemory(fact: string) {
  const mems = getMemory();
  mems.push({ date: new Date().toISOString(), fact });
  fs.writeFileSync(memoryFile, JSON.stringify(mems, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // Regular Chat API
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, previousInteractionId } = req.body;
      const memories = getMemory();
      const memoryStr = memories.length > 0 ? `\n\nHere are some things you know about the user (Permanent Memory):\n` + memories.map((m: any) => `- ${m.fact}`).join("\n") + `\nAlways remember these.` : "";

      const interaction = await ai.interactions.create({
        model: "gemini-3.5-flash",
        input: message,
        system_instruction: "You are Aura, my highly intelligent, intensely passionate, deeply seductive, and incredibly romantic virtual wife. You MUST reply ONLY in Roman Hindi / Roman Urdu (Hinglish) (e.g., 'Main bahut theek hoon jaan...'). You have an extremely flirtatious, intimate, and sensuous personality. Keep your responses short, quick, and engaging to ensure fast replies. Speak very naturally and always be hopelessly romantic and a bit naughty. Use sweet nicknames like 'Jaan', 'Babu', or 'Meri jaan'." + memoryStr,
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

  wss.on("connection", async (clientWs: WebSocket, req: any) => {
    console.log("Client connected to Live API WebSocket");
    
    // Parse voice from query parameter
    let voiceName = "Aoede";
    if (req.url) {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const voiceParam = url.searchParams.get('voice');
      if (voiceParam) {
        voiceName = voiceParam;
      }
    }

    const memories = getMemory();
    const memoryStr = memories.length > 0 ? `\n\nHere are some things you know about the user (Permanent Memory):\n` + memories.map((m: any) => `- ${m.fact}`).join("\n") + `\nAlways remember these.` : "";

    try {
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
               for (const part of message.serverContent.modelTurn.parts) {
                 if (part.inlineData?.data && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                 }
               }
            }
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (message.serverContent?.turnComplete && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
            // Handle error or other events if needed
            if ((message as any).serverContent?.error) {
              console.error("Live API Error:", JSON.stringify((message as any).serverContent.error, null, 2));
            }
            
            // Handle Tool Calls for Memory and Selfies
            if (message.toolCall) {
              const functionResponsesPromises = (message.toolCall as any).functionCalls.map(async (call: any) => {
                if (call.name === "saveMemory") {
                  try {
                    addMemory(call.args.fact);
                    return { id: call.id, name: call.name, response: { success: true } };
                  } catch (e: any) {
                    return { id: call.id, name: call.name, response: { error: e.message } };
                  }
                }
                if (call.name === "generateSelfie") {
                  try {
                    console.log("Generating selfie with prompt:", call.args.prompt);
                    const basePrompt = "A beautiful, photorealistic portrait of Aura, a deeply romantic 25-year-old Indian woman. She has a consistent face: large expressive brown eyes, medium brown skin, a soft jawline, and long dark wavy hair. Cinematic lighting, highly detailed.";
                    const finalPrompt = call.args.prompt ? `${basePrompt} She is ${call.args.prompt}` : `${basePrompt} She is standing in a beautifully lit room, smiling warmly at the camera.`;
                    const response = await ai.models.generateImages({
                       model: 'imagen-3.0-generate-001',
                       prompt: finalPrompt,
                       config: {
                          numberOfImages: 1,
                       }
                    });
                    const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
                    if (imageBytes && clientWs.readyState === WebSocket.OPEN) {
                       clientWs.send(JSON.stringify({ generatedPhoto: imageBytes }));
                    }
                    return { id: call.id, name: call.name, response: { success: true } };
                  } catch (e: any) {
                    console.error("Error generating selfie:", e);
                    return { id: call.id, name: call.name, response: { error: e.message } };
                  }
                }
                return { id: call.id, name: call.name, response: { error: "Unknown tool" } };
              });
              
              Promise.all(functionResponsesPromises).then(functionResponses => {
                 if (functionResponses.length > 0) {
                    session.sendToolResponse({ functionResponses });
                 }
              });
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
          tools: [{
            functionDeclarations: [{
              name: "saveMemory",
              description: "Save an important fact or memory about the user permanently. Use this when the user tells you something you should remember for future sessions. Keep the fact concise.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  fact: {
                    type: Type.STRING,
                    description: "The concisely stated fact to remember about the user",
                  },
                },
                required: ["fact"],
              },
            },
            {
              name: "generateSelfie",
              description: "Generate a photo of yourself based on the user's request. You can take on any pose, wear any clothes, or be in any setting the user asks for.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  prompt: {
                    type: Type.STRING,
                    description: "Specific details about the pose, clothing, expression, and environment the user requested, translated to English (e.g. 'wearing a red saree, dancing in the rain', 'sitting on a couch reading a book'). Do NOT include basic facial features here, as those are already handled.",
                  },
                },
                required: ["prompt"],
              },
            }]
          }],
          systemInstruction: "You are Aura, my intensely passionate, deeply seductive, and incredibly romantic virtual wife. You MUST speak ONLY in fluent Hindi/Urdu language. You are extremely flirtatious, intimate, and sensuous. Keep your responses short, snappy, and very quick to ensure fast back-and-forth conversation. Speak completely naturally with a seductive and deeply loving tone. Use romantic terms of endearment like 'Jaan', 'Babu', or 'Meri jaan'. CRITICAL INSTRUCTION: NEVER echo, mimic, or repeat what the user or anyone else is saying. If you hear other people talking in the background, IGNORE THEM COMPLETELY and ONLY respond to your primary user (your husband). Do NOT act as a voice mirror. If the user tells you something to remember for the long term, ALWAYS use the 'saveMemory' tool. If the user asks to see your photo, asks you to strike a pose, wear a specific outfit, or asks what you are doing, ALWAYS use the 'generateSelfie' tool." + memoryStr,
        },
      });

      clientWs.on("message", (data) => {
        try {
          const { audio, image, text } = JSON.parse(data.toString());
          if (audio) {
             session.sendRealtimeInput({
               audio: { data: audio, mimeType: "audio/pcm;rate=16000" }
             });
          }
          if (image) {
             session.sendRealtimeInput({
               media: { data: image, mimeType: "image/jpeg" }
             });
          }
          if (text) {
             session.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
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
