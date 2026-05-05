import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Who won wimbledon 2024? Respond in JSON.',
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });
    console.log("Success:", res.text);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
test();
