import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { seedIfEmpty } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Database(join(__dirname, 'training.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables (idempotent)
db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf-8'));

seedIfEmpty(db);

export default db;
