// Invoice intake — อัปโหลดใบแจ้งหนี้ (PDF/รูปภาพ) แล้วให้ Gemini อ่านและสกัดข้อมูล
// (เลขที่ Invoice, ผู้ขาย, รายการสินค้า, วันครบกำหนดจ่าย) เพื่อส่งต่อไป prefill
// ใบ PR และใบ Memo ของโครงการ
//
// ทำงานได้ 2 โหมด:
//   - มี GEMINI_API_KEY     → POST /extract เรียก Gemini สกัดข้อมูลอัตโนมัติ
//   - ไม่มี key             → /extract ตอบ 503 (AI_NOT_CONFIGURED) แต่ผู้ใช้ยัง
//     บันทึกข้อมูลเองผ่าน POST /extractions ได้ — เซิร์ฟเวอร์ต้องไม่ล้มเพราะไม่มี key

import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { getGemini, hasGeminiKey } from '../lib/google-client.js';
import db from '../db/db.js';

const router = Router();

// ── File upload (memory storage — เก็บเฉพาะ metadata ไม่เก็บตัวไฟล์) ─────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('รองรับเฉพาะไฟล์ PDF, JPG, PNG และ WebP'), ok);
  },
});

// ── Structured-output schema — บังคับให้โมเดลตอบ JSON ตามรูปนี้เท่านั้น ─────────
// แปลง JSON Schema → Gemini ResponseSchema (SchemaType enum values, nullable prop)
// รุ่น 2.0-flash: ฟรี 100%, 1500 RPM, 15M TPM — เหมาะกบการสกัดข้อมูล
const EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  required: [
    'invoice_number', 'invoice_date', 'due_date', 'vendor_name', 'vendor_tax_id',
    'line_items', 'subtotal', 'vat_amount', 'total_amount', 'uncertain_fields',
  ],
  properties: {
    invoice_number: { type: 'STRING', nullable: true },
    invoice_date:   { type: 'STRING', nullable: true, description: 'YYYY-MM-DD (แปลง พ.ศ. เปน ค.ศ.)' },
    due_date:       { type: 'STRING', nullable: true, description: 'วันครบกำหนดชำระ/ทำจาย YYYY-MM-DD' },
    vendor_name:    { type: 'STRING', nullable: true },
    vendor_tax_id:  { type: 'STRING', nullable: true },
    line_items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['description', 'quantity', 'unit', 'unit_price', 'amount'],
        properties: {
          description: { type: 'STRING' },
          quantity:    { type: 'NUMBER' },
          unit:        { type: 'STRING', nullable: true },
          unit_price:  { type: 'NUMBER' },
          amount:      { type: 'NUMBER' },
        },
      },
    },
    subtotal:     { type: 'NUMBER', nullable: true },
    vat_amount:   { type: 'NUMBER', nullable: true },
    total_amount: { type: 'NUMBER', nullable: true },
    uncertain_fields: { type: 'ARRAY', items: { type: 'STRING' } },
  },
};

const SYSTEM_PROMPT = `คุณคือผู้ช่วยผู้เชี่ยวชาญด้านการอ่านใบแจ้งหนี้ (Invoice) ทั้งภาษาไทยและภาษาอังกฤษ

กฎสำคัญ:
1. ดึงรายการสินค้า/บริการทุกรายการที่พบในเอกสาร
2. จำนวนเงินทุกช่องเป็นตัวเลขล้วน (ห้ามมีลูกน้ำหรือสัญลักษณ์สกุลเงิน)
3. วันที่ทุกช่องใช้รูปแบบ YYYY-MM-DD — ถ้าเอกสารเป็นปี พ.ศ. ให้แปลงเป็น ค.ศ. (ลบ 543)
4. due_date คือวันครบกำหนดชำระ/วันที่ต้องทำจ่าย (Due Date / Payment Term) — ถ้าเอกสารระบุเป็นเครดิตกี่วัน ให้คำนวณจากวันที่ใบแจ้งหนี้
5. ช่องที่ไม่มีข้อมูลในเอกสารให้ใส่ null — ห้ามเดา
6. ช่องไหนอ่านได้ไม่ชัดหรือไม่มั่นใจ ให้ใส่ชื่อ field นั้นลงใน uncertain_fields`;

// ── GET /api/invoices/status — ให้ UI รู้ว่าตั้งค่า AI แล้วหรือยัง ─────────────
router.get('/status', (_req, res) => {
  res.json({ ai_ready: hasGeminiKey() });
});

// ── POST /api/invoices/extract ────────────────────────────────────────────────
// multipart/form-data: file (PDF/รูป), project_id (optional)
router.post('/extract', upload.single('file'), async (req, res, next) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });

  const gemini = getGemini();
  if (!gemini) {
    return res.status(503).json({
      error: 'AI_NOT_CONFIGURED',
      message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ — กรอกข้อมูลเองด้านล่างได้ หรือติดต่อผู้ดูแลระบบเพื่อเปิดใช้ AI',
    });
  }

  const projectId = Number(req.body?.project_id) || null;
  const base64File = file.buffer.toString('base64');
  const mimeType = file.mimetype;

  try {
    const model = gemini.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
      },
    });

    const result = await model.generateContent({
      systemInstruction: SYSTEM_PROMPT,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64File,
              },
            },
            { text: 'ดึงข้อมูลจากใบแจ้งหนี้ (Invoice) นี้ตาม schema ที่กำหนด' },
          ],
        },
      ],
    });

    const response = result.response;
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      return res.status(502).json({ error: 'AI ปฏิเสธการอ่านเอกสารน้ี — กรอกข้อมูลเองแทนได' });
    }

    const rawText = response.text() || '';
    let extraction = null;
    try {
      extraction = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) { try { extraction = JSON.parse(jsonMatch[1]); } catch {} }
    }
    if (!extraction) {
      return res.status(502).json({ error: 'อ่านผลลัพธ์จาก AI ไม่สำเร็จ — ลองใหม่หรือกรอกข้อมูลเอง' });
    }

    // self-check: ผลรวมรายการต้องตรงกับ subtotal (หรือ total ถ้าไม่มี subtotal)
    if (!Array.isArray(extraction.uncertain_fields)) extraction.uncertain_fields = [];
    const lineTotal = (extraction.line_items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const expect = Number(extraction.subtotal ?? extraction.total_amount) || 0;
    const mismatch = expect > 0 && Math.abs(lineTotal - expect) >= 0.01;
    if (mismatch && !extraction.uncertain_fields.includes('subtotal_mismatch')) {
      extraction.uncertain_fields.push('subtotal_mismatch');
    }
    extraction.confidence_flag = extraction.uncertain_fields.length > 0;

    const recordId = randomUUID();
    await db.execute({
      sql: `INSERT INTO invoice_extractions
              (id, project_id, file_name, file_mime_type, file_size, extraction_data,
               confidence_flag, uncertain_fields, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [
        recordId, projectId, file.originalname, file.mimetype, file.buffer.byteLength,
        JSON.stringify(extraction),
        extraction.confidence_flag ? 1 : 0,
        JSON.stringify(extraction.uncertain_fields),
      ],
    });

    res.json({ id: recordId, extraction });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    next(Object.assign(new Error('สกัดข้อมูล Invoice ไม่สำเร็จ: ' + err.message), { status: 502 }));
  }
});

// ── POST /api/invoices/extractions — บันทึกข้อมูลที่กรอกเอง (ไม่ผ่าน AI) ────────
router.post('/extractions', async (req, res, next) => {
  try {
    const { project_id, file_name, extraction } = req.body || {};
    if (!extraction) return res.status(400).json({ error: 'extraction is required' });
    const recordId = randomUUID();
    await db.execute({
      sql: `INSERT INTO invoice_extractions
              (id, project_id, file_name, file_mime_type, file_size, extraction_data,
               confidence_flag, uncertain_fields, status)
            VALUES (?, ?, ?, '', 0, ?, 0, '[]', 'confirmed')`,
      args: [recordId, Number(project_id) || null, String(file_name || 'กรอกเอง'), JSON.stringify(extraction)],
    });
    res.json({ id: recordId, extraction });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/invoices/extractions?project_id=N ───────────────────────────────
router.get('/extractions', async (req, res, next) => {
  try {
    const projectId = Number(req.query.project_id) || null;
    const rows = await db.execute({
      sql: `SELECT id, project_id, file_name, file_mime_type, file_size, extraction_data,
                   confidence_flag, uncertain_fields, created_at, status
            FROM invoice_extractions
            ${projectId ? 'WHERE project_id = ?' : ''}
            ORDER BY created_at DESC`,
      args: projectId ? [projectId] : [],
    });
    res.json(rows.rows.map((r) => ({
      ...r,
      extraction_data: JSON.parse(r.extraction_data || '{}'),
      uncertain_fields: JSON.parse(r.uncertain_fields || '[]'),
    })));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/invoices/extractions/:id ────────────────────────────────────────
router.get('/extractions/:id', async (req, res, next) => {
  try {
    const row = await db.execute({
      sql: `SELECT id, project_id, file_name, file_mime_type, file_size, extraction_data,
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

// ── PATCH /api/invoices/extractions/:id/confirm — ผู้ใช้ตรวจ/แก้แล้วยืนยัน ─────
router.patch('/extractions/:id/confirm', async (req, res, next) => {
  try {
    const { extraction } = req.body || {};
    const fields = ["status = 'confirmed'", "updated_at = datetime('now')"];
    const args = [];
    if (extraction) {
      const lineTotal = (extraction.line_items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
      const expect = Number(extraction.subtotal ?? extraction.total_amount) || 0;
      const mismatch = expect > 0 && Math.abs(lineTotal - expect) >= 0.01;
      fields.push('extraction_data = ?', 'confidence_flag = ?', 'uncertain_fields = ?');
      args.push(JSON.stringify(extraction), mismatch ? 1 : 0, JSON.stringify(extraction.uncertain_fields || []));
    }
    args.push(req.params.id);
    await db.execute({
      sql: `UPDATE invoice_extractions SET ${fields.join(', ')} WHERE id = ?`,
      args,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/invoices/extractions/:id ─────────────────────────────────────
router.delete('/extractions/:id', async (req, res, next) => {
  try {
    await db.execute({ sql: 'DELETE FROM invoice_extractions WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
