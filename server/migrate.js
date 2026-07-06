/**
 * Migration script: imports dump.sql into Turso.
 *
 * Before running, generate dump.sql from inside training-app/:
 *   sqlite3 server/db/training.db "PRAGMA wal_checkpoint(TRUNCATE);"
 *   sqlite3 server/db/training.db .dump > server/db/dump.sql
 *
 * Run (clean import — wipes Turso tables first):
 *   node server/migrate.js --wipe
 *
 * Run (append only — fails if tables already exist):
 *   node server/migrate.js
 *
 * Exit 0 = success, Exit 1 = error (check log above).
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const DUMP_PATH = join(__dirname, 'db', 'dump.sql');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  intMode: 'number',
});

if (process.argv.includes('--wipe')) {
  // Drop in child-first order so FK references don't block
  const toDrop = [
    'v_competency_gap',
    'employee_roadmaps', 'employee_competency_scores', 'competency_course_mapping',
    'position_competency_profiles', 'competency_departments', 'competency_assignments',
    'eval_responses', 'eval_attachments', 'eval_form_items',
    'training_evaluations', 'training_registrations',
    'project_participants', 'project_schedule', 'training_records', 'project_dsd_assessments',
    'availability_slots', 'candidate_dates', 'training_projects',
    'training_plan_topics', 'training_plans',
    'course_topics', 'course_relations',
    'employees', 'competencies', 'eval_forms', 'eval_items', 'courses', 'training_topics',
    'positions', 'departments',
  ];
  for (const name of toDrop) {
    await db.execute(`DROP VIEW IF EXISTS "${name}"`).catch(() => {});
    await db.execute(`DROP TABLE IF EXISTS "${name}"`).catch(() => {});
  }
  console.log('[migrate] Wiped all tables and views.');
}

// Strip UTF-8 BOM if present (PowerShell Out-File adds one)
const raw = readFileSync(DUMP_PATH, 'utf-8').replace(/^﻿/, '');

// Filter by line (not split on ';') to preserve semicolons inside string values.
// Allow PRAGMA foreign_keys — Turso needs it to skip FK validation during import.
// Block PRAGMA writable_schema — modifies sqlite_master, not supported on Turso.
// Block sqlite_sequence — Turso manages this internal table itself.
const filtered = raw
  .split('\n')
  .filter((l) => {
    const up = l.trim().toUpperCase();
    if (up.includes('SQLITE_SEQUENCE')) return false;
    if (!up.startsWith('PRAGMA')) return true;
    return up.startsWith('PRAGMA FOREIGN_KEYS');
  })
  .join('\n');

console.log('[migrate] Sending dump to Turso...');

try {
  await db.executeMultiple(filtered);
  console.log('[migrate] Done.');
} catch (e) {
  console.error('[migrate] Failed:', e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
