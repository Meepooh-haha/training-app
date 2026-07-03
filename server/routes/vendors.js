import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

const DOC_TYPES = ['book_bank', 'pp20', 'company_cert', 'vendor_form'];

// Recompute is_registered after every document status change.
// count < 4  → is_registered = 0, registered_date = NULL  (de-registration path)
// count >= 4 → is_registered = 1, registered_date = today
async function recalcRegistration(vendorId) {
  const row = await q.get(
    "SELECT COUNT(*) AS n FROM vendor_documents WHERE vendor_id = ? AND status IN ('received','verified')",
    [vendorId],
  );
  if ((row?.n ?? 0) >= 4) {
    await q.run(
      "UPDATE vendors SET is_registered = 1, registered_date = date('now') WHERE id = ?",
      [vendorId],
    );
  } else {
    await q.run(
      'UPDATE vendors SET is_registered = 0, registered_date = NULL WHERE id = ?',
      [vendorId],
    );
  }
}

// Build a full 4-row document list, filling gaps with synthetic pending rows.
// Never returns raw file_data (base64 can be MBs); use file_url for Drive links.
function buildDocList(vendorId, rows) {
  const byType = Object.fromEntries(rows.map(r => [r.doc_type, r]));
  return DOC_TYPES.map(t => {
    const r = byType[t];
    if (!r) return {
      id: null, vendor_id: vendorId, doc_type: t,
      status: 'pending', file_url: null, has_file: false,
      storage_type: 'base64', file_format: null,
      received_date: null, created_at: null, updated_at: null,
    };
    return {
      id: r.id, vendor_id: r.vendor_id, doc_type: r.doc_type,
      status: r.status, storage_type: r.storage_type, file_format: r.file_format,
      file_url: r.storage_type === 'url' ? r.file_data : null,
      has_file: !!r.file_data,
      received_date: r.received_date, created_at: r.created_at, updated_at: r.updated_at,
    };
  });
}

// ── Vendors ───────────────────────────────────────────────────────────────────

router.get('/vendors', h(async (req, res) => {
  const { search } = req.query;
  const base = `
    SELECT v.*,
      (SELECT COUNT(*) FROM vendor_documents d
       WHERE d.vendor_id = v.id AND d.status IN ('received','verified')) AS docs_complete
    FROM vendors v`;
  if (search) {
    const term = `%${search}%`;
    return res.json(await q.all(
      base + ' WHERE v.vendor_name LIKE ? OR v.tax_id LIKE ? ORDER BY v.vendor_name',
      [term, term],
    ));
  }
  res.json(await q.all(base + ' ORDER BY v.vendor_name'));
}));

router.get('/vendors/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  const vendor = await q.get('SELECT * FROM vendors WHERE id = ?', [id]);
  if (!vendor) return res.status(404).json({ error: 'ไม่พบ vendor' });

  const rows = await q.all(
    'SELECT * FROM vendor_documents WHERE vendor_id = ? ORDER BY doc_type',
    [id],
  );
  res.json({ ...vendor, documents: buildDocList(id, rows) });
}));

router.post('/vendors', h(async (req, res) => {
  const { vendor_name, tax_id, vendor_type, contact_name, contact_phone, contact_email } = req.body;

  if (!String(vendor_name || '').trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อ vendor' });
  }
  if (!['instructor', 'venue', 'other'].includes(vendor_type)) {
    return res.status(400).json({ error: 'vendor_type ต้องเป็น instructor, venue หรือ other' });
  }

  const cleanTaxId = String(tax_id || '').trim() || null;
  if (cleanTaxId) {
    const dup = await q.get('SELECT id, vendor_name FROM vendors WHERE tax_id = ?', [cleanTaxId]);
    if (dup) {
      return res.status(409).json({
        error: `มี vendor "${dup.vendor_name}" ที่ใช้เลขผู้เสียภาษี ${cleanTaxId} อยู่แล้ว (id: ${dup.id})`,
        existing_id: dup.id,
      });
    }
  }

  const r = await q.run(
    `INSERT INTO vendors (vendor_name, tax_id, vendor_type, contact_name, contact_phone, contact_email)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      String(vendor_name).trim(),
      cleanTaxId,
      vendor_type,
      contact_name || null,
      contact_phone || null,
      contact_email || null,
    ],
  );
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));

router.patch('/vendors/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await q.get('SELECT id FROM vendors WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'ไม่พบ vendor' });

  const { vendor_name, tax_id, vendor_type, contact_name, contact_phone, contact_email, drive_folder_url } = req.body;

  const fields = [];
  const args = [];

  if (vendor_name !== undefined) {
    if (!String(vendor_name || '').trim()) return res.status(400).json({ error: 'ต้องระบุชื่อ vendor' });
    fields.push('vendor_name = ?'); args.push(String(vendor_name).trim());
  }
  if (tax_id !== undefined) {
    fields.push('tax_id = ?'); args.push(String(tax_id || '').trim() || null);
  }
  if (vendor_type !== undefined) {
    if (!['instructor', 'venue', 'other'].includes(vendor_type)) {
      return res.status(400).json({ error: 'vendor_type ต้องเป็น instructor, venue หรือ other' });
    }
    fields.push('vendor_type = ?'); args.push(vendor_type);
  }
  if (contact_name       !== undefined) { fields.push('contact_name = ?');       args.push(contact_name || null); }
  if (contact_phone      !== undefined) { fields.push('contact_phone = ?');      args.push(contact_phone || null); }
  if (contact_email      !== undefined) { fields.push('contact_email = ?');      args.push(contact_email || null); }
  if (drive_folder_url   !== undefined) { fields.push('drive_folder_url = ?');   args.push(drive_folder_url || null); }

  if (!fields.length) return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องการแก้ไข' });

  args.push(id);
  await q.run(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`, args);
  res.json({ ok: true });
}));

// ── Vendor documents ──────────────────────────────────────────────────────────

router.get('/vendors/:id/documents', h(async (req, res) => {
  const id = Number(req.params.id);
  const vendor = await q.get('SELECT id FROM vendors WHERE id = ?', [id]);
  if (!vendor) return res.status(404).json({ error: 'ไม่พบ vendor' });

  const rows = await q.all(
    'SELECT * FROM vendor_documents WHERE vendor_id = ? ORDER BY doc_type',
    [id],
  );
  res.json(buildDocList(id, rows));
}));

// POST: upload / replace a document file → auto-sets status to 'received'
router.post('/vendors/:id/documents', h(async (req, res) => {
  const vendorId = Number(req.params.id);
  const vendor = await q.get('SELECT id FROM vendors WHERE id = ?', [vendorId]);
  if (!vendor) return res.status(404).json({ error: 'ไม่พบ vendor' });

  const { doc_type, file_data, file_format, storage_type = 'base64' } = req.body;

  if (!DOC_TYPES.includes(doc_type)) {
    return res.status(400).json({ error: `doc_type ต้องเป็น: ${DOC_TYPES.join(', ')}` });
  }
  if (file_format && !['image', 'pdf'].includes(file_format)) {
    return res.status(400).json({ error: 'file_format ต้องเป็น image หรือ pdf' });
  }
  if (!['base64', 'url'].includes(storage_type)) {
    return res.status(400).json({ error: 'storage_type ต้องเป็น base64 หรือ url' });
  }

  // Upsert: insert หรือ update ถ้า doc_type นี้มีแล้ว
  await q.run(
    `INSERT INTO vendor_documents (vendor_id, doc_type, file_data, storage_type, file_format, status, received_date)
     VALUES (?, ?, ?, ?, ?, 'received', date('now'))
     ON CONFLICT(vendor_id, doc_type) DO UPDATE SET
       file_data     = excluded.file_data,
       storage_type  = excluded.storage_type,
       file_format   = excluded.file_format,
       status        = 'received',
       received_date = date('now')`,
    [vendorId, doc_type, file_data || null, storage_type, file_format || null],
  );

  await recalcRegistration(vendorId);

  const doc = await q.get(
    'SELECT id FROM vendor_documents WHERE vendor_id = ? AND doc_type = ?',
    [vendorId, doc_type],
  );
  const updatedVendor = await q.get(
    'SELECT is_registered, registered_date FROM vendors WHERE id = ?',
    [vendorId],
  );
  res.status(201).json({ id: doc.id, ...updatedVendor });
}));

// PATCH: เปลี่ยน status เอกสาร (received → verified, หรือ revert กลับ pending)
router.patch('/vendors/:id/documents/:docId', h(async (req, res) => {
  const vendorId = Number(req.params.id);
  const docId    = Number(req.params.docId);

  const doc = await q.get(
    'SELECT id FROM vendor_documents WHERE id = ? AND vendor_id = ?',
    [docId, vendorId],
  );
  if (!doc) return res.status(404).json({ error: 'ไม่พบเอกสาร' });

  const { status } = req.body;
  if (!['pending', 'received', 'verified'].includes(status)) {
    return res.status(400).json({ error: 'status ต้องเป็น pending, received หรือ verified' });
  }

  await q.run('UPDATE vendor_documents SET status = ? WHERE id = ?', [status, docId]);
  await recalcRegistration(vendorId);

  const updatedVendor = await q.get(
    'SELECT is_registered, registered_date FROM vendors WHERE id = ?',
    [vendorId],
  );
  res.json({ ok: true, ...updatedVendor });
}));

// ── Vendor status badge (for TrainingRequest gate check) ──────────────────────

router.get('/instructors/:id/vendor-status', h(async (req, res) => {
  const inst = await q.get(
    'SELECT id, name, source_type, vendor_id FROM instructors WHERE id = ?',
    [Number(req.params.id)],
  );
  if (!inst) return res.status(404).json({ error: 'ไม่พบวิทยากร' });
  if (!inst.vendor_id) return res.json({ linked: false, source_type: inst.source_type });

  const vendor = await q.get('SELECT * FROM vendors WHERE id = ?', [inst.vendor_id]);
  const { n: docs_complete } = await q.get(
    "SELECT COUNT(*) AS n FROM vendor_documents WHERE vendor_id = ? AND status IN ('received','verified')",
    [inst.vendor_id],
  );
  res.json({ linked: true, source_type: inst.source_type, vendor, docs_complete, docs_total: 4 });
}));

router.get('/venues/:id/vendor-status', h(async (req, res) => {
  const venue = await q.get(
    'SELECT id, name, source_type, vendor_id FROM venues WHERE id = ?',
    [Number(req.params.id)],
  );
  if (!venue) return res.status(404).json({ error: 'ไม่พบสถานที่' });
  if (!venue.vendor_id) return res.json({ linked: false, source_type: venue.source_type });

  const vendor = await q.get('SELECT * FROM vendors WHERE id = ?', [venue.vendor_id]);
  const { n: docs_complete } = await q.get(
    "SELECT COUNT(*) AS n FROM vendor_documents WHERE vendor_id = ? AND status IN ('received','verified')",
    [venue.vendor_id],
  );
  res.json({ linked: true, source_type: venue.source_type, vendor, docs_complete, docs_total: 4 });
}));

export default router;
