// Invoice extraction route — accepts a PDF or image, calls Anthropic Claude
// Vision API to extract invoice data, and stores metadata in Turso.
//
// Endpoint: POST /api/invoices/extract
// Body: multipart/form-data with a `file` field (PDF, JPG, or PNG).
// Returns: JSON with the extracted data and the db record id.

import { Router } from 'express';
import multer from 'multer';
import { join } from 'path';
import { randomUUID } from 'crypto';
import anthropic from '../lib/anthropic-client.js';
import db from '../db/db.js';

const router = Router();

// ── File upload (memory storage — we only need metadata, not the file blob) ──
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB cap
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, PNG, and WebP files are accepted'));
    }
  },
});

// ── System prompt — enforces structured JSON output + self-check ──
const SYSTEM_PROMPT = `คณคคือผ้ชว่ยกทเช่ียวชาญดานการอานใบแจงหนี้ (Invoice) ภาษาไทยและอังกฤษ

ใหค้ืนคา JSON เทานัน้ ตาม schema ที่กำหนด

กฎสำคญ:
1. ตองคืนคา JSON เทานัน้ ตาม schema — ไมม่ีขอความอืนๆ
2. ตรวจสอบว่า sum(line_items[].amount) ตรงกบ subtotal หรอไม
   - ถ้าไม่ตรง ใหค้onfidence_flag = true และใส "subtotal_mismatch" ใน uncertain_fields
3. ระบ uncertain_fields เปน array ของ field names ที่โมเดลไมม่มั่่นใจ (เชน vendor_name, invoice_number, etc.)
4. vendor_tax_id อาจเปน null ถ้าไมมีในเอกสาร
5. line_items: ดึงททุกรายการที่พบ
6. จำนวนเงนเปนตัวเลข (ไมใช string) — quantity, unit_price, amount ทั้งหมดเปน number
7. invoice_date: ใหในรูป "YYYY-MM-DD" ถ้าเปนภาษาไทยใหแปลงใหถกตอง
8. subtotal, vat_amount, total_amount: เปน number (รวมภาษีมูลคาเพิ่่มถ้ามมี)
9. confidence_flag: true ถ้า subtotal_mismatch หรอ uncertain_fields ไม่วา่ง

Schema:
{
  "type": "object",
  "properties": {
    "invoice_number": {"type": "string"},
    "invoice_date": {"type": "string"},
    "vendor_name": {"type": "string"},
    "vendor_tax_id": {"type": ["string", "null"]},
    "line_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": {"type": "string"},
          "quantity": {"type": "number"},
          "unit_price": {"type": "number"},
          "amount": {"type": "number"}
        },
        "required": ["description", "quantity", "unit_price", "amount"]
      }
    },
    "subtotal": {"type": "number"},
    "vat_amount": {"type": "number"},
    "total_amount": {"type": "number"},
    "confidence_flag": {"type": "boolean"},
    "uncertain_fields": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["invoice_number", "invoice_date", "vendor_name", "line_items", "subtotal", "vat_amount", "total_amount", "confidence_flag", "uncertain_fields"]
}`;

// ── POST /api/invoices/extract ────────────────────────────────────────────────
router.post('/extract', upload.single('file'), async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const recordId = randomUUID();
  const base64File = file.buffer.toString('base64');
  const mimeType = file.mimetype;
  const dataUrl = `data:${mimeType};base64,${base64File}`;

  try {
    // ── Call Anthropic Claude Vision API ──
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64File,
              },
            },
            {
              type: 'text',
              text: 'กรุณาดึงข้อมูลจากใบแจ้งหนี้ (Invoice) นี้ให้เป็น JSON ตามที่กำหนด',
            },
          ],
        },
      ],
    });

    // ── Parse the JSON from the response ──
    let extraction;
    const contentBlock = response.content.find(
      (block) => block.type === 'text'
    );
    const rawText = contentBlock?.text || '';

    try {
      extraction = JSON.parse(rawText);
    } catch {
      // Fallback: try to extract JSON from markdown code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      extraction = jsonMatch ? JSON.parse(jsonMatch[1]) : null;
    }

    if (!extraction) {
      return res.status(502).json({
        error: 'Failed to parse extraction result from AI model',
      });
    }

    // ── Server-side self-check: sum(line_items[].amount) vs subtotal ──
    const lineTotal = (extraction.line_items || []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
    const subtotalMatch =
      Math.abs(lineTotal - (Number(extraction.subtotal) || 0)) < 0.01;

    if (!subtotalMatch) {
      extraction.confidence_flag = true;
      if (!Array.isArray(extraction.uncertain_fields)) {
        extraction.uncertain_fields = [];
      }
      if (!extraction.uncertain_fields.includes('subtotal_mismatch')) {
        extraction.uncertain_fields.push('subtotal_mismatch');
      }
    }

    // ── Store metadata in Turso (file_data intentionally omitted per spec) ──
    await db.execute({
      sql: `INSERT INTO invoice_extractions
        (id, file_name, file_mime_type, file_size, extraction_data,
         confidence_flag, uncertain_fields, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [
        recordId,
        file.originalname,
        mimeType,
        file.buffer.byteLength,
        JSON.stringify(extraction),
        extraction.confidence_flag ? 1 : 0,
        JSON.stringify(extraction.uncertain_fields || []),
      ],
    });

    res.json({
      id: recordId,
      extraction,
    });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    next(
      Object.assign(new Error('Invoice extraction failed: ' + err.message), {
        status: 502,
      })
    );
  }
});

// ── GET /api/invoices/extractions ─────────────────────────────────────────────
// List all extractions (audit trail)
router.get('/extractions', async (_req, res, next) => {
  try {
    const rows = await db.execute({
      sql: `SELECT id, file_name, file_mime_type, file_size, extraction_data,
                    confidence_flag, uncertain_fields, created_at, status
             FROM invoice_extractions
             ORDER BY id DESC`,
    });
    res.json(
      rows.rows.map((r) => ({
        ...r,
        extraction_data: JSON.parse(r.extraction_data || '{}'),
        uncertain_fields: JSON.parse(r.uncertain_fields || '[]'),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/invoices/extractions/:id/confirm ───────────────────────────────
// User confirms the extraction — stores status = 'confirmed'
router.patch('/extractions/:id/confirm', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { extraction } = req.body; // Allow updating the extracted data

    // Update extraction_data if user made edits
    const updateFields = [];
    const args = [];
    if (extraction) {
      updateFields.push('extraction_data = ?');
      args.push(JSON.stringify(extraction));

      // Recalculate confidence_flag and uncertain_fields from updated data
      const lineTotal = (extraction.line_items || []).reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0
      );
      const subtotalMatch =
        Math.abs(lineTotal - (Number(extraction.subtotal) || 0)) < 0.01;

      updateFields.push('confidence_flag = ?');
      args.push(subtotalMatch ? 0 : 1);
      updateFields.push('uncertain_fields = ?');
      args.push(JSON.stringify(extraction.uncertain_fields || []));
    }

    updateFields.push("status = 'confirmed'");
    updateFields.push("updated_at = datetime('now')");

    args.push(id);

    await db.execute({
      sql: `UPDATE invoice_extractions
             SET ${updateFields.join(', ')}
             WHERE id = ?`,
      args,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/invoices/extractions/:id ─────────────────────────────────────────
// Get a single extraction by id (for prefilling forms)
router.get('/extractions/:id', async (req, res, next) => {
  try {
    const row = await db.execute({
      sql: `SELECT id, file_name, file_mime_type, file_size, extraction_data,
                    confidence_flag, uncertain_fields, created_at, status
             FROM invoice_extractions WHERE id = ?`,
      args: [req.params.id],
    });
    const r = row.rows[0];
    if (!r) return res.status(404).json({ error: 'Not found' });

    res.json({
      ...r,
      extraction_data: JSON.parse(r.extraction_data || '{}'),
      uncertain_fields: JSON.parse(r.uncertain_fields || '[]'),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
