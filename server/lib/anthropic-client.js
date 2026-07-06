// Lazy Anthropic client — imported by route handlers.
// API key comes from ANTHROPIC_API_KEY environment variable (loaded by
// dotenv in db.js before any route module evaluates).
//
// สร้างแบบ lazy โดยตั้งใจ: ถ้ายังไม่ตั้งค่า key เซิร์ฟเวอร์ต้องบูตได้ปกติ
// (หน้ารับ Invoice ใช้โหมดกรอกมือได้) — ห้ามให้ constructor โยน error ตอน import.

import Anthropic from '@anthropic-ai/sdk';

let client = null;

export function hasAnthropicKey() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getAnthropic() {
  if (!hasAnthropicKey()) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
