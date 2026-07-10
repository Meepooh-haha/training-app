# Specification: ช่อง Import วางข้อมูล Proposal ทั้งชุดครั้งเดียว (Node โครงร่างและกำหนดการอบรม)

> เขียนโดย BUILD (EKKA) 2026-07-10 จากการตัดสินใจของผู้ใช้: ขอบเขต = Step 1 + Step 2, พฤติกรรม = preview เสมอ + ยืนยัน "เขียนทับทั้งชุด", format = JSON ตาม `ai-agent-training-pdf-guide.md` (ขยาย backward-compatible)

## 1. เป้าหมายและประสบการณ์ผู้ใช้

เพิ่ม "ช่องวาง JSON" ใน Node **โครงร่างและกำหนดการอบรม** (`schedule` route) เพื่อให้ผู้ใช้เอาผลลัพธ์ JSON ที่ AI (TRAIN) สกัดจาก PDF วิทยากรมาวางครั้งเดียว แล้วระบบเติมทั้ง **Step 1 โครงร่าง** และ **Step 2 กำหนดการ** ให้อัตโนมัติ แทนการพิมพ์มือทีละช่อง

ประสบการณ์ผู้ใช้ที่ล็อกแล้ว (ห้ามเปลี่ยน):

1. ผู้ใช้เปิด Node → เห็นการ์ด **"นำเข้าจาก JSON (Proposal ทั้งชุด)"**
2. วาง JSON ลงในกล่องข้อความ → กด **"ตรวจสอบก่อนนำเข้า"**
3. ระบบ **แสดง preview เสมอ** ก่อนเขียนข้อมูลจริง โดยแสดง:
   - ค่าที่จะเขียนลง Step 1 (โครงร่าง) — เน้นช่องที่จะ "กลายเป็นค่าว่าง" ให้เห็นชัด
   - รูปแบบวันอบรม + รายการวันที่ที่ normalize แล้ว
   - ตารางกำหนดการรายวันที่จะเขียนลง Step 2
   - `warnings` และ `missingFields` จาก JSON (แสดงเด่นชัด สีเหลือง)
   - รายชื่อวิทยากรที่พบ พร้อมข้อความกำกับว่า **จะไม่ถูกเพิ่มเข้าข้อมูลหลักอัตโนมัติ**
4. ผู้ใช้กดปุ่ม **"เขียนทับทั้งชุด"** → ระบบ **แทนข้อมูล Node นี้ทั้งหมด** (Step 1 outline fields บน `training_projects` + `schedule_*` settings + `project_schedule` rows ทั้งชุด)
5. ไม่มีการ merge, ไม่บล็อกแม้มี warnings/missingFields (ผู้ใช้ตัดสินใจเอง)

**หลักการสำคัญ:** ฟีเจอร์นี้คือมนุษย์วาง JSON + กดยืนยันเท่านั้น — **ไม่มี API ให้ AI ยิงข้อมูลเข้าระบบตรง** และ **ไม่แตะรายชื่อผู้เข้าอบรม** (`project_participants`)

---

## 2. ขอบเขต

### ต้องทำ

- เพิ่ม UI ช่องวาง JSON + preview + ปุ่มยืนยันใน `SchedulePage.jsx`
- แยก logic การ parse/map ออกเป็นโมดูล pure function ใหม่ `client/src/lib/proposalImport.js` (ทดสอบได้, ไม่ทำให้ `SchedulePage.jsx` บวม)
- ใช้ **endpoint เดิม** ในการเขียน: `PATCH /training-projects/:id/details` (Step 1) และ `PUT /training-projects/:id/schedule` (Step 2) — ห้ามสร้าง route ใหม่
- ปิดช่องโหว่ 3 จุด: นาทีทฤษฎี/ปฏิบัติ, mapping `trainingDateMode`, mapping `content` ↔ `subtopics`
- ขยาย JSON contract แบบ backward-compatible และแก้ `docs/ai-agent-training-pdf-guide.md` ให้ตรงกัน

### ไม่ทำในรอบนี้ (สิ่งที่ห้ามทำ)

- **ห้าม** สร้าง server route ใหม่สำหรับ import — ใช้ `details` + `schedule` เดิม
- **ห้าม** duplicate `computeSchedule` ฝั่ง server — การคำนวณเวลาต้องอยู่ฝั่ง client (`coursePlanUtils.js`) ตาม invariant ใน CLAUDE.md
- **ห้าม** แตะ Setup master data อัตโนมัติ — วิทยากรใหม่จาก JSON **ห้าม auto-add** เข้า `instructors`/`training_topics` (การเพิ่มเข้าข้อมูลหลักเป็นการกระทำแยกที่ผู้ใช้ต้องกดเอง ตามกติกาใน guide)
- **ห้าม** เขียนหรือแตะ `project_participants` — `participantCount` ใน JSON เป็นข้อมูล preview อ่านอย่างเดียว
- **ห้าม** ทำ API endpoint ให้ AI ยิงข้อมูลเข้าระบบตรง
- **ห้าม** merge — พฤติกรรมเดียวคือ overwrite ทั้งชุดหลังผู้ใช้กดยืนยัน
- **ห้าม** บล็อกการ overwrite เพราะมี warnings/missingFields
- **ห้าม** migrate งานเก่า และ **ห้าม** hand-edit generated docx templates (`proposal_pack_template.docx` / `schedule_template.docx`)

---

## 3. สถาปัตยกรรมที่ตัดสินใจแล้ว (พร้อมเหตุผล)

| การตัดสินใจ | รายละเอียด | เหตุผล |
|---|---|---|
| แยก logic เป็น `proposalImport.js` | Pure function `parseProposalJson` + `mapProposalToNode` | ทดสอบได้โดยไม่ต้อง render, ไม่ทำให้ `SchedulePage.jsx` (ยาวอยู่แล้ว) รก |
| ใช้ endpoint เดิม | `PATCH /details` + `PUT /schedule` | `PUT /schedule` ลบแล้วเขียนใหม่ทั้งชุด (`DELETE FROM project_schedule` แล้ว INSERT) = overwrite semantics ตรงกับที่ต้องการอยู่แล้ว |
| คำนวณเวลาฝั่ง client | เรียก `computeSchedule` ใน `mapProposalToNode` ก่อนส่ง | รักษา invariant "time computation stays client-side" |
| เพิ่มคอลัมน์ `theory_minutes`/`practice_minutes` ที่ `project_schedule` | ALTER แบบ idempotent + JSON field ใหม่ | เช็คลิสต์กรมพัฒนาฝีมือแรงงาน (ฟอร์ม ยป.) ต้องแยก ชม.ทฤษฎี/ปฏิบัติ ต่อหัวข้อ ซึ่ง DB เดิมไม่มี |
| Speaker ต่อ session ไม่เก็บรายแถว | รวมเป็น `trainer_name` เดียว + แสดง preview | `project_schedule` ไม่มีคอลัมน์ speaker และ locked decision ห้ามออกแบบ field ใหม่โดยไม่จำเป็น; วิทยากรระดับโครงการอยู่ที่ `training_projects.trainer_name` |

---

## 4. ปิดช่องโหว่: mapping ที่ต้องนิยามชัด

### 4.1 นาทีทฤษฎี/ปฏิบัติ (theory/practice minutes)

**สถานะจริงที่ตรวจพบ:**
- `project_schedule` **ไม่มี** คอลัมน์นาทีทฤษฎี/ปฏิบัติ (มีแค่ `duration_minutes`)
- `training_topics` มีแค่ `type` = `บรรยาย` / `บรรยายและปฏิบัติ` (ข้อความ, ไม่ใช่ตัวเลขนาที) และไม่ได้ copy ลง `project_schedule`
- ฟอร์ม Step 2 ปัจจุบันไม่มีช่องกรอกนาทีทฤษฎี/ปฏิบัติ

**การออกแบบ:**
1. เพิ่มคอลัมน์ `theory_minutes INTEGER DEFAULT 0` และ `practice_minutes INTEGER DEFAULT 0` ที่ `project_schedule`
   - แก้ `server/db/schema.sql` (เพิ่มใน `CREATE TABLE project_schedule`)
   - เพิ่ม idempotent ALTER ใน `server/db/db.js` ตามแพทเทิร์นเดิม:
     ```js
     try { await db.execute("ALTER TABLE project_schedule ADD COLUMN theory_minutes INTEGER DEFAULT 0"); } catch {}
     try { await db.execute("ALTER TABLE project_schedule ADD COLUMN practice_minutes INTEGER DEFAULT 0"); } catch {}
     ```
2. ขยาย JSON: `session.theoryMinutes` / `session.practiceMinutes` (optional, ตัวเลขนาที)
3. `PUT /training-projects/:id/schedule` เพิ่ม 2 คอลัมน์นี้ในคำสั่ง INSERT (อ่านจาก `t.theory_minutes` / `t.practice_minutes`, fallback 0)
4. `GET /training-projects/:id/schedule` (ฝั่ง seed) เติมค่า default: `theory_minutes = duration_minutes`, `practice_minutes = 0` (เพราะ master ไม่มีข้อมูลแยก — ผู้ใช้/JSON แก้ทีหลังได้) แถวที่บันทึกแล้วอ่านตรงจากคอลัมน์
5. เพิ่ม 2 ช่อง input เล็ก (number) ในตารางหัวข้อ Step 2 ของ `SchedulePage.jsx` ให้แก้ค่าได้ (คอลัมน์ "ทฤษฎี(น.)" / "ปฏิบัติ(น.)")
6. Preview + Step 2 แสดง **warning** เมื่อ `theory_minutes + practice_minutes` ไม่เท่ากับ `duration_minutes` ของหัวข้อนั้น

> หมายเหตุขอบเขต: การ **render** นาทีทฤษฎี/ปฏิบัติลงเอกสาร docx เป็นงานของฟอร์ม ยป. ในอนาคต — รอบนี้แค่ **เก็บข้อมูลให้ครบ** พร้อมใช้ ไม่แตะ template docx

### 4.2 Mapping `trainingDateMode` (guide) → `date_mode` (แอป)

Guide ใช้คนละชื่อกับ `coursePlanUtils`/DB ต้อง map ตรงตามตารางนี้เสมอ:

| `trainingDateMode` (JSON) | `date_mode` (แอป/DB) | การ normalize วันที่ |
|---|---|---|
| `single_day` | `single` | `training_date = end_date = trainingDays[0].date` |
| `continuous_days` | `consecutive` | `training_date = วันแรก`, `end_date = วันสุดท้าย` (เรียงแล้ว) |
| `separate_days` | `separate` | `separateDates = ทุก date ใน trainingDays` (dedupe+sort ผ่าน `uniqueSortedDates`), `training_date = วันแรก`, `end_date = วันสุดท้าย` |
| `unknown` | `separate` | ถ้ามีวันที่ใน `trainingDays` → ใช้เป็น `separate`; ถ้าไม่มีวันที่เลย → เว้นวันว่างไว้ + เพิ่ม warning แรง "ต้องเลือกวันอบรมใน Step 1 ก่อนสร้างเอกสาร" (ยังกด "เขียนทับทั้งชุด" ได้ ตาม locked decision "ไม่บล็อก") |

Export เป็นค่าคงที่ใน `proposalImport.js`:
```js
export const TRAINING_DATE_MODE_MAP = {
  single_day: 'single',
  continuous_days: 'consecutive',
  separate_days: 'separate',
  unknown: 'separate',
};
```

### 4.3 Mapping `topic` / `content` / `subtopics`

- `session.topic` → `project_schedule.topic_name`
- `session.content` (เนื้อหาย่อ) → `project_schedule.subtopics` (TEXT, 1 บรรทัด = 1 bullet) โดยคง newline เดิมของ content ไว้ ถ้า content เป็นข้อความยาวบรรทัดเดียวก็เก็บเป็น 1 bullet
- ถ้า JSON ส่ง `subtopics` มาตรง ๆ (array หรือ string) ให้ใช้อันนั้นก่อน `content` (array → join ด้วย `\n`)
- `topic_name` ว่างแต่มี `content` → เพิ่ม `missingFields: "หัวข้อ (วันที่ ... session ...)"` และยังนำเข้าได้

### 4.4 Speaker ต่อ session

- `project_schedule` ไม่มีคอลัมน์ speaker → **ไม่เก็บรายแถว**
- รวบ `session.speakerName` (หรือ `session.speaker` แบบ string/`{name}`) ทั้งหมด → distinct list
- ถ้า `outline.trainerName` ว่าง และมีวิทยากร distinct = 1 คน → เติม `trainer_name` ให้; ถ้า > 1 คน → เติมคนแรก + warning "มีวิทยากรหลายคนในกำหนดการ ตรวจชื่อวิทยากรหลักในโครงร่าง"
- แสดง speakers ทั้งหมดใน preview พร้อมข้อความ "จะไม่ถูกเพิ่มเข้าข้อมูลหลักอัตโนมัติ"
- **ห้าม** เขียนลง `instructors`

---

## 5. JSON Contract ที่รับ (ขยายจาก `ai-agent-training-pdf-guide.md`)

ยึด format เดิมของ guide เป็นหลัก และ **ขยายแบบ backward-compatible** (ทุก field ใหม่เป็น optional; JSON เดิมยังนำเข้าได้)

```jsonc
{
  "confidence": "high | medium | low",
  "needsUserReview": true,
  "sourceSummary": { "fileName": "", "detectedDocumentType": "", "language": "" },

  "outline": {
    "courseName": "",
    "objectives": [],                 // array → join '\n' ลง objective
    "targetAudience": "",             // → target_group
    "participantCount": null,         // preview only — ห้ามเขียน DB
    "venue": "",                      // → location
    "evaluationMethod": "",           // ถ้าไม่มี split ด้านล่าง → ลง success_qualitative + warning
    "successQuantitative": "",        // (ใหม่) → success_quantitative
    "successQualitative": "",         // (ใหม่) → success_qualitative
    "trainerName": "",                // (ใหม่) → trainer_name; ว่าง = derive จาก speakers
    "trainerOrg": ""                  // (ใหม่) → trainer_org
  },

  "trainingDateMode": "single_day | continuous_days | separate_days | unknown",
  "trainingDateInput": { "singleDate": null, "startDate": null, "endDate": null, "separateDates": [] },

  "scheduleSettings": {               // (ใหม่, optional) ถ้าไม่ส่ง = คงค่าเดิมของโครงการ
    "dailyStartTime": "HH:mm",        // → schedule_start_time
    "hoursPerDay": 6,                 // → schedule_hours_per_day
    "lunchStart": "HH:mm",            // → schedule_lunch_start ('' = ปิดพักเที่ยง)
    "lunchEnd": "HH:mm"               // → schedule_lunch_end
  },

  "trainingDays": [
    {
      "date": "YYYY-MM-DD",
      "sourceDateText": "",
      "sessions": [
        {
          "startTime": "HH:mm",
          "endTime": "HH:mm",
          "durationMinutes": null,    // (ใหม่) ถ้าไม่มี → คำนวณจาก end-start
          "theoryMinutes": null,      // (ใหม่) → theory_minutes
          "practiceMinutes": null,    // (ใหม่) → practice_minutes
          "topic": "",                // → topic_name
          "content": "",              // → subtopics
          "subtopics": [],            // (ใหม่, optional) มาก่อน content ถ้ามี
          "speakerName": "",          // preview + derive trainer_name เท่านั้น
          "note": "",                 // preview only (ไม่เก็บ DB)
          "confidence": ""
        }
      ]
    }
  ],

  "speakers": [ { "name": "", "foundInMasterData": false, "suggestAddToMaster": false } ],
  "missingFields": [],
  "warnings": []
}
```

**Mapping outline → `PATCH /details` payload:**

| JSON | ฟิลด์ DB / details | กติกา overwrite |
|---|---|---|
| `outline.courseName` | `name` | ถ้าว่าง → **ไม่ส่ง** (server reject name ว่าง; คงชื่อเดิม) |
| `outline.objectives` (array) | `objective` | join `\n`; ว่าง → ส่งค่าว่าง (เคลียร์) |
| `outline.targetAudience` | `target_group` | ว่าง → เคลียร์ |
| `outline.venue` | `location` | ว่าง → เคลียร์ |
| `outline.successQuantitative` | `success_quantitative` | ว่าง → เคลียร์ |
| `outline.successQualitative` | `success_qualitative` | ว่าง → เคลียร์ |
| `outline.evaluationMethod` (ถ้าไม่มี split) | `success_qualitative` | + warning "แปลงวิธีประเมินผลเป็นเชิงคุณภาพ ตรวจการแยกปริมาณ/คุณภาพ" |
| `outline.trainerName` | `trainer_name` | ว่าง → derive จาก speakers |
| `outline.trainerOrg` | `trainer_org` | ว่าง → เคลียร์ |
| วันที่ (จาก `trainingDays` + mode) | `training_date`, `end_date` | ตามตาราง 4.2 |
| `outline.participantCount` | — | preview only, ห้ามเขียน |

> พฤติกรรม overwrite: ทุก field ข้อความที่ map ได้จะถูกแทนค่าจาก JSON **รวมถึงเคลียร์เป็นค่าว่างถ้า JSON ว่าง** (ตาม locked decision "แทนข้อมูล Node นี้ทั้งหมด") ยกเว้น `name` ที่ห้ามส่งว่าง preview ต้องเน้นช่องที่จะกลายเป็นว่างให้ผู้ใช้เห็นก่อนกดยืนยัน

**Mapping session → topics[] (ก่อนส่ง `PUT /schedule`):**

- `topic_name` = `session.topic`
- `subtopics` = `session.subtopics` (join) หรือ `session.content`
- `duration_minutes` = `session.durationMinutes` → ถ้าไม่มี คำนวณ `endTime - startTime` → ถ้าไม่ได้ ใช้ `theoryMinutes + practiceMinutes` → ถ้าไม่ได้ = 0 (+ warning "หัวข้อไม่มีระยะเวลา")
- `theory_minutes` = `session.theoryMinutes` (fallback 0)
- `practice_minutes` = `session.practiceMinutes` (fallback 0)
- `date` = `trainingDays[].date`, `start_time`/`end_time` = จาก session
- หลัง map เสร็จ เรียก `computeSchedule(topics, date_mode, settings)`:
  - `single`/`consecutive` → เวลาถูกคำนวณใหม่จาก `daily_start_time` + duration + พักเที่ยง (เวลาจาก JSON เป็นแค่ตัวช่วยหา duration)
  - `separate` → คง `start_time` จาก JSON, เติม `end_time` จาก duration

**Mapping scheduleSettings → settings + `PUT /schedule`:**

- ถ้ามี `scheduleSettings` → ใช้ค่านั้น
- ถ้าไม่มี → **คงค่าเดิม** ของโครงการ (`daily_start_time`, `hours_per_day`, `lunch_start`, `lunch_end`) ไม่ reset เป็น default (เพราะเป็น layout preference ไม่ใช่เนื้อหา proposal)
- `date_mode` มาจาก `TRAINING_DATE_MODE_MAP` เสมอ

---

## 6. ไฟล์/module ที่ต้องแตะ

### Client
| ไฟล์ | การเปลี่ยน |
|---|---|
| `client/src/lib/proposalImport.js` | **ไฟล์ใหม่** — `TRAINING_DATE_MODE_MAP`, `parseProposalJson`, `mapProposalToNode` |
| `client/src/pages/Development/SchedulePage.jsx` | เพิ่มการ์ด import (textarea + preview + ปุ่มยืนยัน) วางไว้บนสุดของ Node; เพิ่ม handler `runImport`; เพิ่ม 2 คอลัมน์ input ทฤษฎี/ปฏิบัติในตาราง Step 2; เพิ่ม warning ผลรวมนาทีไม่ตรง |
| `client/src/lib/coursePlanUtils.js` | ไม่แก้ logic คำนวณ; `computeSchedule` ใช้ `{ ...t }` จึงพา field ใหม่ไปเอง — ตรวจยืนยันอย่างเดียว ไม่ต้องแก้ |

### Server
| ไฟล์ | การเปลี่ยน |
|---|---|
| `server/db/schema.sql` | เพิ่มคอลัมน์ `theory_minutes` / `practice_minutes` ใน `CREATE TABLE project_schedule` |
| `server/db/db.js` | เพิ่ม idempotent ALTER 2 บรรทัด (แพทเทิร์นเดิม) |
| `server/routes/training-projects.js` | `PUT /:id/schedule` เพิ่ม 2 คอลัมน์ใน INSERT; `GET /:id/schedule` seed เติม default theory/practice |

### Docs
| ไฟล์ | การเปลี่ยน |
|---|---|
| `docs/ai-agent-training-pdf-guide.md` | เพิ่ม field ใหม่ในตัวอย่าง JSON (`successQuantitative/Qualitative`, `trainerName/Org`, `durationMinutes`, `theoryMinutes`, `practiceMinutes`, `subtopics[]`, `scheduleSettings`); เพิ่มหัวข้อ "Mapping ชื่อ mode → date_mode ของแอป"; ระบุ `content` → `subtopics`; ย้ำ import = overwrite ทั้งชุด + วิทยากรใหม่ไม่ auto-add |
| `docs/training-outline-schedule-spec.md` | เพิ่มลิงก์อ้างถึงฟีเจอร์ import (1–2 บรรทัด, optional) |

---

## 7. Interface (สัญญาระหว่างส่วน)

### `client/src/lib/proposalImport.js`

```js
export const TRAINING_DATE_MODE_MAP = { /* ตาม 4.2 */ };

// แยก parse ออกจาก map เพื่อจับ JSON พังก่อน
export function parseProposalJson(text) {
  // return { ok: true, data } | { ok: false, error: 'ข้อความภาษาไทย' }
}

// map JSON → โครงสร้างพร้อมเขียน; ไม่ยิง network เอง
export function mapProposalToNode(data, { project }) {
  return {
    outline,        // object พร้อมส่ง PATCH /details (มีเฉพาะ key ที่ควรเขียน)
    settings,       // { date_mode, daily_start_time, hours_per_day, lunch_start, lunch_end, start_date }
    separateDates,  // string[]
    topics,         // ผ่าน computeSchedule แล้ว พร้อมส่ง PUT /schedule (มี theory/practice)
    preview: {      // สำหรับ render
      outlineRows,      // [{ label, value, willClear }]
      dateMode, dates,  // แสดงรูปแบบวัน + รายการวัน
      days,             // [{ date, rows:[{ start_time,end_time,topic_name,subtopics,duration_minutes,theory_minutes,practice_minutes,minutesMismatch }] }]
      participantCount, // แสดงเฉย ๆ
    },
    speakers,       // [{ name, foundInMasterData }]
    warnings,       // string[] (รวม warning ที่ map เองสร้าง + warnings จาก JSON)
    missingFields,  // string[] (รวมของ JSON + ที่ตรวจเจอเพิ่ม)
  };
}
```

### handler ใน `SchedulePage.jsx` (ตอนกด "เขียนทับทั้งชุด")

ลำดับเรียก (ใช้ endpoint เดิม, ห้ามสร้างใหม่):
1. `api.patch('/training-projects/${id}/details', outline)` — ส่งเฉพาะ key ที่ map ได้ (guard `name` ว่าง)
2. `api.put('/training-projects/${id}/schedule', { ...settings, topics })`
3. `await reloadShell()` + `await load()` (โหลด schedule ใหม่)
4. `setStep('outline')` + `toast.success('เขียนทับทั้งชุดแล้ว — ตรวจ Step 1 แล้วไป Step 2 ต่อ')`

### Server `PUT /:id/schedule` — INSERT ที่แก้

เพิ่ม `theory_minutes`, `practice_minutes` เข้า column list + args:
```
INSERT INTO project_schedule
  (project_id, topic_code, topic_name, sequence, date, start_time, end_time,
   duration_minutes, subtopics, theory_minutes, practice_minutes)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```
args เพิ่ม: `Number(t.theory_minutes) || 0`, `Number(t.practice_minutes) || 0`

---

## 8. Acceptance Criteria (ตรวจได้จริง)

1. เปิด Node เห็นการ์ด "นำเข้าจาก JSON" มี textarea + ปุ่ม "ตรวจสอบก่อนนำเข้า"
2. วาง JSON ถูก format แล้วกดตรวจสอบ → เห็น preview เสมอ ก่อนข้อมูลจริงถูกเขียน (ยังไม่มีการเรียก PATCH/PUT ตอนนี้)
3. Preview แสดง: ค่า Step 1 ที่จะเขียน (เน้นช่องที่จะกลายเป็นว่าง), รูปแบบวัน + รายการวัน, ตารางกำหนดการรายวัน, warnings, missingFields, รายชื่อวิทยากร + ข้อความ "ไม่ auto-add"
4. กด "เขียนทับทั้งชุด" → `training_projects` (outline + schedule_* settings) และ `project_schedule` ถูกแทนทั้งชุด, `project_participants` **ไม่เปลี่ยน**
5. `single_day` → `date_mode=single`, `training_date=end_date`=วันเดียว, 1 วันในตาราง
6. `continuous_days` 3 วัน → `date_mode=consecutive`, `training_date`=วันแรก, `end_date`=วันสุดท้าย
7. `separate_days` วันไม่ติดกัน 3 วัน → `date_mode=separate`, `separateDates` เรียง+dedupe ครบ 3 วัน
8. `trainingDateMode=unknown` + ไม่มีวันที่ → นำเข้าได้ (ไม่บล็อก), วันว่างไว้, มี warning ให้เลือกวันใน Step 1
9. JSON ที่ parse ไม่ได้ → แสดง error ภาษาไทย, ไม่แสดง preview, **ไม่เขียน DB**
10. JSON ขาด field → ยังนำเข้าได้, `missingFields` แสดงครบ, ช่องที่ว่างเคลียร์จริง (ยกเว้น name)
11. `session.content` ปรากฏเป็น `subtopics` (bullets) ในตาราง Step 2 และ preview
12. `theoryMinutes`/`practiceMinutes` ถูกบันทึกลง `project_schedule` และแสดงในคอลัมน์ Step 2; ถ้า theory+practice ≠ duration → เห็น warning
13. วิทยากรจาก JSON **ไม่ถูกเพิ่ม** เข้า `instructors`; `trainer_name` ถูก derive เมื่อ outline ไม่ระบุ
14. วางซ้ำแล้วกดยืนยันอีกครั้ง → ผลลัพธ์ทับของเดิมสนิท (idempotent), ไม่เกิดแถวซ้ำ
15. หลังยืนยัน กด "บันทึกและสร้างเอกสารรวม" เดิม → ได้ docx ที่มีหน้าโครงร่าง + กำหนดการรายวันตามข้อมูลที่ import
16. โครงการ Public: Node นี้ถูกซ่อน (`publicHidden`) — ไม่ต้องมี UI import พิเศษ (ฟีเจอร์อยู่ในหน้าที่ซ่อนอยู่แล้ว)
17. ไม่มี server route ใหม่; `computeSchedule` ไม่ถูก duplicate ฝั่ง server

---

## 9. Edge cases

| กรณี | พฤติกรรมที่ต้องได้ |
|---|---|
| JSON ว่าง/ไม่ใช่ JSON/ไม่ใช่ object | error ภาษาไทย, ไม่ preview, ไม่เขียน |
| ไม่มี `outline` หรือไม่มี `trainingDays` | นำเข้าเท่าที่มี + missingFields; ถ้าไม่มีทั้งคู่ → error "ไม่พบข้อมูล proposal" |
| `courseName` ว่าง | ไม่ส่ง `name` (คงชื่อเดิม), ไม่ทำ server error |
| วันที่ format ผิด (ไม่ใช่ YYYY-MM-DD) | ข้ามวันนั้น + warning "รูปแบบวันที่ไม่ถูกต้อง: ..." |
| `separateDates`/`trainingDays` มีวันซ้ำ | dedupe ผ่าน `uniqueSortedDates` |
| session ไม่มี `startTime`/`endTime`/`durationMinutes` | duration=0 + warning |
| `endTime < startTime` | คง duration ที่คำนวณได้/ให้ 0 + warning |
| เวลาไม่ใช่ HH:mm | ข้ามเวลานั้น (เว้นว่าง) + warning |
| theory+practice ≠ duration | นำเข้าได้ + warning (ไม่บล็อก) |
| หัวข้อว่างแต่มี content | นำเข้าได้ + missingFields หัวข้อ |
| วิทยากรหลายคน | trainer_name = คนแรก + warning |
| วางซ้ำ | overwrite สนิท idempotent |
| โครงการ Public | Node ซ่อน — ไม่ต้องจัดการพิเศษ |
| JSON ใหญ่/หลายวันมาก | ทำงานได้ (ตารางยาว scroll) |

---

## 10. ความปลอดภัย

- Import ทำงานฝั่ง client ทั้งหมด + เขียนผ่าน endpoint เดิมที่มี validation อยู่แล้ว — ไม่เปิด surface ใหม่
- ห้ามใช้ `eval`/`Function` ในการ parse — ใช้ `JSON.parse` ใน try/catch เท่านั้น
- ค่าที่เขียนต้องผ่าน normalize เดิมของ `PATCH /details` (trim/number) และ `PUT /schedule` — ไม่ trust ตัวเลข/สตริงจาก JSON ตรง ๆ
- ไม่มีการรับไฟล์อัปโหลด/เรียก AI ในฟีเจอร์นี้ (input เป็นข้อความ JSON ที่ผู้ใช้วางเอง)
- ไม่เขียน `project_participants`, `instructors`, `training_topics` — จำกัด blast radius ที่ `training_projects` + `project_schedule` ของโครงการเดียว

---

## 11. แผนทดสอบ

**Unit (`proposalImport.js`):**
- map ทั้ง 4 mode → `date_mode` + วันที่ถูกต้อง
- content → subtopics, subtopics[] มาก่อน content
- duration precedence (durationMinutes > end-start > theory+practice > 0)
- theory/practice ผ่านเข้า topics ครบ; ตรวจ warning ผลรวมไม่ตรง
- trainer_name derive: 0/1/หลายคน
- missingFields/warnings รวมของ JSON + ที่สร้างเอง
- JSON พัง → `{ ok:false }`

**Integration (server):**
- `PUT /schedule` เขียน/อ่าน theory_minutes/practice_minutes กลับได้
- `GET /schedule` seed มี default theory/practice
- overwrite ซ้ำ → ไม่เกิดแถวซ้ำ

**Manual (UI):**
- วาง JSON ตัวอย่างจาก guide → preview → ยืนยัน → Step 1/Step 2 เต็มถูกต้อง
- ทดสอบทั้ง 4 mode + unknown
- ทดสอบ JSON พัง, field ขาด, วิทยากรใหม่ (เช็คว่า master ไม่ถูกแตะ)
- สร้าง docx รวมหลัง import → ลำดับหน้าถูก

---

## 12. ลำดับ Milestone

1. **M1 — DB + Server:** เพิ่มคอลัมน์ theory/practice (schema.sql + db.js ALTER), แก้ `PUT/GET /schedule` + unit ฝั่ง server
2. **M2 — Logic:** `proposalImport.js` (`parseProposalJson`, `mapProposalToNode`, `TRAINING_DATE_MODE_MAP`) + unit test ครบ edge case
3. **M3 — UI import:** การ์ด textarea + preview + ปุ่ม "เขียนทับทั้งชุด" ใน `SchedulePage.jsx` เรียก endpoint เดิม
4. **M4 — UI theory/practice:** 2 คอลัมน์ input ในตาราง Step 2 + warning ผลรวมไม่ตรง
5. **M5 — Docs:** อัปเดต `ai-agent-training-pdf-guide.md` (JSON ใหม่ + mapping table) และ cross-link ใน `training-outline-schedule-spec.md`
6. **M6 — ทดสอบ end-to-end:** manual ครบทุก mode + สร้าง docx ตรวจลำดับหน้า

---

## 13. หมายเหตุการส่งมอบ (สำหรับเพื่อนร่วมงาน)

- ฟีเจอร์นี้ "วาง JSON แล้วกดยืนยัน" เท่านั้น — AI ไม่ได้เขียนข้อมูลเข้าระบบเอง มนุษย์เป็นคนกดทุกครั้ง
- ทุกครั้งที่กดยืนยัน = **ทับข้อมูล Node นี้ทั้งหมด** ของโครงการนั้น (โครงร่าง + กำหนดการ) — ไม่รวมรายชื่อผู้เข้าอบรม
- ถ้า preview เตือนว่าช่องไหน "จะกลายเป็นว่าง" แปลว่า JSON ที่วางไม่มีข้อมูลช่องนั้น ให้เติมใน JSON ก่อนหรือมากรอกมือทีหลังใน Step 1
- วิทยากรใหม่ที่เจอใน JSON จะ **ไม่ถูกเพิ่ม** เข้าข้อมูลหลักให้อัตโนมัติ ต้องไปเพิ่มเองที่ Setup ถ้าต้องการเก็บถาวร
