// Lazy Google Generative AI client — imported by route handlers.
// API key comes from GEMINI_API_KEY environment variable (loaded by
// dotenv in db.js before any route module evaluates).
//
// สร้างแบบ lazy โดยตั้งใจ: ถ้ายังไม่ตั้งค่า key เซิร์ฟเวอร์ต้องบูตได้ปกติ
// (หน้ารับ Invoice ใช้โหมดกรอกมือได้) — ห้ามให้ constructor โยน error ตอน import.

import { GoogleGenerativeAI } from '@google/generative-ai';

let client = null;

export function hasGeminiKey() {
  return !!process.env.GEMINI_API_KEY;
}

export function getGemini() {
  if (!hasGeminiKey()) return null;
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}
