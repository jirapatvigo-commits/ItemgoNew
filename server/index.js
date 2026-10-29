import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';

const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.join(here, 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const app = express();
const port = Number(process.env.PORT || 4000);
const publicAppUrl = (process.env.PUBLIC_APP_URL || 'http://localhost/Itemgo').replace(/\/$/, '');
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost,http://127.0.0.1,http://localhost:8080,http://127.0.0.1:8080')
  .split(',')
  .map((origin) => origin.trim());
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'itemgo',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
});

const hasSmtpCredentials = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
const mailer = hasSmtpCredentials
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD.replace(/\s+/g, '') }
        : undefined,
    })
  : null;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/uploads', express.static(uploadDirectory));

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const makeToken = () => crypto.randomBytes(32).toString('base64url');
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const publicUser = ({ id, email, full_name, department, building, role, created_at }) => ({
  id,
  email,
  full_name,
  department,
  building,
  role,
  created_at,
});
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validEntity = (name) => ['Asset', 'LoanRecord'].includes(name);
const isAdmin = (user) => user?.role === 'admin';
const ownsLoan = (record, user) => record.borrower_user_id === user.id || record.created_by_id === user.id;
const MAX_ATTACHED_PHOTOS = 8;
const normalizePhotoUris = (multiple, single) => [...new Set([
  ...(Array.isArray(multiple) ? multiple : []),
  single,
].filter((uri) => typeof uri === 'string' && uri.trim()))];

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      department VARCHAR(255) NOT NULL DEFAULT '',
      building VARCHAR(255) NOT NULL DEFAULT '',
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [userColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('department', 'building')`,
  );
  const existingUserColumns = new Set(userColumns.map((column) => column.COLUMN_NAME));
  const missingUserColumns = [
    !existingUserColumns.has('department') && "ADD COLUMN department VARCHAR(255) NOT NULL DEFAULT ''",
    !existingUserColumns.has('building') && "ADD COLUMN building VARCHAR(255) NOT NULL DEFAULT ''",
  ].filter(Boolean);
  if (missingUserColumns.length) {
    await pool.query(`ALTER TABLE users ${missingUserColumns.join(', ')}`);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX sessions_expiry_idx (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entity_records (
      entity_name VARCHAR(40) NOT NULL,
      id CHAR(36) NOT NULL,
      data JSON NOT NULL,
      created_by_id CHAR(36) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_name, id),
      INDEX entity_created_idx (entity_name, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash CHAR(64) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT password_resets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX password_resets_expiry_idx (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

const authenticate = asyncRoute(async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });

  const [rows] = await pool.execute(
    `SELECT u.id, u.email, u.full_name, u.department, u.building, u.role, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP`,
    [hashToken(token)],
  );
  if (!rows.length) return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  req.user = publicUser(rows[0]);
  req.rawToken = token;
  next();
});

function matchesValue(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('$ne' in expected) return actual !== expected.$ne;
    if ('$gt' in expected) return Number(actual) > Number(expected.$gt);
    if ('$regex' in expected) {
      try {
        return new RegExp(expected.$regex, expected.$options || '').test(String(actual ?? ''));
      } catch {
        return false;
      }
    }
    return false;
  }
  return actual === expected;
}

function matchesQuery(item, query = {}) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return Array.isArray(expected) && expected.some((part) => matchesQuery(item, part));
    return matchesValue(item[key], expected);
  });
}

function sortRecords(items, sort) {
  if (!sort) return items;
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return [...items].sort((a, b) => {
    const left = a[field] ?? '';
    const right = b[field] ?? '';
    const result = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), 'th');
    return descending ? -result : result;
  });
}

async function readRecords(entityName) {
  const [rows] = await pool.execute(
    'SELECT data FROM entity_records WHERE entity_name = ? ORDER BY created_at DESC',
    [entityName],
  );
  return rows.map((row) => typeof row.data === 'string' ? JSON.parse(row.data) : row.data);
}

async function restoreAssetQuantity(connection, loan) {
  if (!loan.asset_id) return;
  const [rows] = await connection.execute(
    'SELECT data FROM entity_records WHERE entity_name = ? AND id = ? FOR UPDATE',
    ['Asset', loan.asset_id],
  );
  if (!rows.length) return;
  const asset = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
  const maximum = Number(asset.total_quantity) || Number.MAX_SAFE_INTEGER;
  const updatedAsset = {
    ...asset,
    available_quantity: Math.min(maximum, Number(asset.available_quantity || 0) + (Number(loan.quantity) || 1)),
    updated_date: new Date().toISOString(),
  };
  await connection.execute(
    'UPDATE entity_records SET data = ? WHERE entity_name = ? AND id = ?',
    [JSON.stringify(updatedAsset), 'Asset', loan.asset_id],
  );
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'mysql' });
}));

app.get('/api/app/public-settings', (_req, res) => {
  res.json({ id: 'itemgo', public_settings: { name: 'Itemgo' } });
});

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const fullName = String(req.body?.full_name || '').trim();
  const department = String(req.body?.department || '').trim();
  const building = String(req.body?.building || '').trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' });
  }
  if (!fullName || !department || !building) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ แผนก/ฝ่าย และตึกให้ครบ' });
  }
  if (fullName.length > 255 || department.length > 255 || building.length > 255) {
    return res.status(400).json({ error: 'ข้อมูลชื่อ แผนก/ฝ่าย และตึกต้องไม่เกิน 255 ตัวอักษร' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });

  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว' });

  const user = {
    id: crypto.randomUUID(),
    email,
    full_name: fullName,
    department,
    building,
    role: 'user',
  };
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    'INSERT INTO users (id, email, password_hash, full_name, department, building, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user.id, user.email, passwordHash, user.full_name, user.department, user.building, user.role],
  );
  const token = makeToken();
  await pool.execute(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY))',
    [hashToken(token), user.id],
  );
  res.status(201).json({ token, user: { ...user, created_at: new Date().toISOString() } });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const requestedRole = req.body?.role;
  if (!['admin', 'user'].includes(requestedRole)) {
    return res.status(400).json({ error: 'กรุณาเลือกประเภทบัญชีเพื่อเข้าสู่ระบบ' });
  }
  const [rows] = await pool.execute(
    'SELECT id, email, password_hash, full_name, department, building, role, created_at FROM users WHERE email = ?',
    [email],
  );
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
  if (rows[0].role !== requestedRole) {
    return res.status(403).json({ error: 'บัญชีนี้ไม่ตรงกับประเภทการเข้าสู่ระบบที่เลือก' });
  }
  const user = publicUser(rows[0]);
  const token = makeToken();
  await pool.execute(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY))',
    [hashToken(token), user.id],
  );
  res.json({ token, user });
}));

app.get('/api/auth/me', authenticate, (req, res) => res.json(req.user));
app.post('/api/auth/logout', authenticate, asyncRoute(async (req, res) => {
  await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [hashToken(req.rawToken)]);
  res.status(204).end();
}));

app.post('/api/auth/password-reset', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (!rows.length) return res.json({ success: true });
  const token = makeToken();
  await pool.execute('DELETE FROM password_resets WHERE user_id = ?', [rows[0].id]);
  await pool.execute(
    'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE))',
    [hashToken(token), rows[0].id],
  );
  const resetUrl = `${publicAppUrl}/reset-password?token=${encodeURIComponent(token)}`;
  if (mailer) {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'ตั้งรหัสผ่าน TrainingNIMT ใหม่',
      text: `เปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (หมดอายุใน 30 นาที): ${resetUrl}`,
    });
    return res.json({ success: true });
  }
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า SMTP สำหรับส่งอีเมล' });
  }
  res.json({ success: true, reset_url: resetUrl });
}));

app.post('/api/auth/password-reset/complete', asyncRoute(async (req, res) => {
  const token = String(req.body?.resetToken || '');
  const password = String(req.body?.newPassword || '');
  if (password.length < 8) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
  const [rows] = await pool.execute(
    'SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP',
    [hashToken(token)],
  );
  if (!rows.length) return res.status(400).json({ error: 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว' });
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, rows[0].user_id]);
  await pool.execute('DELETE FROM password_resets WHERE user_id = ?', [rows[0].user_id]);
  await pool.execute('DELETE FROM sessions WHERE user_id = ?', [rows[0].user_id]);
  res.json({ success: true });
}));

const imageStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});
const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) return callback(new Error('อนุญาตให้อัปโหลดไฟล์รูปภาพเท่านั้น'));
    callback(null, true);
  },
});
app.post('/api/uploads', authenticate, uploadImage.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });
  res.status(201).json({ file_uri: `${req.protocol}://${req.get('host')}/api/uploads/${req.file.filename}` });
});

app.use('/api/entities/:entityName', (req, res, next) => {
  if (!validEntity(req.params.entityName)) return res.status(404).json({ error: 'ไม่พบข้อมูลประเภทนี้' });
  const isPublicAssetRead = req.params.entityName === 'Asset'
    && (req.method === 'GET' || (req.method === 'POST' && ['/filter', '/count'].includes(req.path)));
  if (isPublicAssetRead) return next();
  return authenticate(req, res, next);
});

app.post('/api/entities/:entityName/count', asyncRoute(async (req, res) => {
  const records = await readRecords(req.params.entityName);
  const visible = req.params.entityName === 'LoanRecord' && !isAdmin(req.user)
    ? records.filter((item) => ownsLoan(item, req.user))
    : records;
  res.json({ count: visible.filter((item) => matchesQuery(item, req.body?.query || {})).length });
}));

app.post('/api/entities/:entityName/filter', asyncRoute(async (req, res) => {
  const records = await readRecords(req.params.entityName);
  const visible = req.params.entityName === 'LoanRecord' && !isAdmin(req.user)
    ? records.filter((item) => ownsLoan(item, req.user))
    : records;
  const filtered = visible.filter((item) => matchesQuery(item, req.body?.query || {}));
  const sorted = sortRecords(filtered, req.body?.options?.sort);
  const limit = Math.min(Math.max(Number(req.body?.options?.limit) || 100, 1), 500);
  res.json({ items: sorted.slice(0, limit) });
}));

app.get('/api/entities/:entityName/:id', asyncRoute(async (req, res) => {
  const records = await readRecords(req.params.entityName);
  const item = records.find((record) => record.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการ' });
  if (req.params.entityName === 'LoanRecord' && !isAdmin(req.user) && !ownsLoan(item, req.user)) {
    return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการ' });
  }
  res.json(item);
}));

app.post('/api/entities/:entityName/:id/approval', asyncRoute(async (req, res) => {
  if (req.params.entityName !== 'LoanRecord') {
    return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการ' });
  }
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่อนุมัติรายการได้' });
  }

  const { id } = req.params;
  const { decision } = req.body || {};
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT data FROM entity_records WHERE entity_name = ? AND id = ? FOR UPDATE',
      ['LoanRecord', id],
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการ' });
    }

    const loan = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    let updated;
    if (loan.status === 'รออนุมัติยืม' && decision === 'approve') {
      const approverName = String(req.body?.approver_name || req.body?.lender_name || '').trim();
      const borrowPhotoUris = normalizePhotoUris(req.body?.borrow_photo_uris, req.body?.borrow_photo_uri);
      if (borrowPhotoUris.length > MAX_ATTACHED_PHOTOS) {
        await connection.rollback();
        return res.status(400).json({ error: `แนบรูปก่อนยืมได้สูงสุด ${MAX_ATTACHED_PHOTOS} รูป` });
      }
      if (!approverName) {
        await connection.rollback();
        return res.status(400).json({ error: 'กรุณาระบุชื่อผู้อนุมัติ' });
      }
      updated = {
        ...loan,
        status: 'กำลังยืม',
        loan_approved_by_name: approverName,
        lender_name: approverName,
        lender_signature: approverName,
        borrow_photo_uris: borrowPhotoUris,
        borrow_photo_uri: borrowPhotoUris[0] || '',
        loan_approved_by_id: req.user.id,
        loan_approved_at: new Date().toISOString(),
      };
    } else if (loan.status === 'รออนุมัติยืม' && decision === 'reject') {
      await restoreAssetQuantity(connection, loan);
      updated = { ...loan, status: 'ไม่อนุมัติยืม', loan_rejected_at: new Date().toISOString() };
    } else if (loan.status === 'รออนุมัติคืน' && decision === 'approve') {
      await restoreAssetQuantity(connection, loan);
      updated = {
        ...loan,
        status: 'คืนแล้ว',
        return_date: loan.return_request_date || new Date().toISOString().slice(0, 10),
        return_approved_at: new Date().toISOString(),
      };
    } else if (loan.status === 'รออนุมัติคืน' && decision === 'reject') {
      updated = {
        ...loan,
        status: 'กำลังยืม',
        return_request_date: '',
        return_photo_uris: [],
        return_photo_uri: '',
        return_signature: '',
        return_note: '',
        return_rejected_at: new Date().toISOString(),
      };
    } else {
      await connection.rollback();
      return res.status(409).json({ error: 'สถานะรายการเปลี่ยนไปแล้วหรือดำเนินการนี้ไม่ถูกต้อง' });
    }

    updated.updated_date = new Date().toISOString();
    await connection.execute(
      'UPDATE entity_records SET data = ? WHERE entity_name = ? AND id = ?',
      [JSON.stringify(updated), 'LoanRecord', id],
    );
    await connection.commit();
    res.json(updated);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.post('/api/entities/:entityName', asyncRoute(async (req, res) => {
  const entityName = req.params.entityName;
  if (entityName === 'Asset' && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มสินทรัพย์ได้' });
  }
  if (entityName === 'Asset' && !String(req.body?.asset_name || '').trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อสินทรัพย์' });
  }
  const record = {
    ...req.body,
    id: crypto.randomUUID(),
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    created_by_id: req.user.id,
  };
  if (entityName === 'Asset') {
    const photoUris = normalizePhotoUris(record.photo_uris, record.photo_uri);
    if (photoUris.length > MAX_ATTACHED_PHOTOS) {
      return res.status(400).json({ error: `แนบรูปสินทรัพย์ได้สูงสุด ${MAX_ATTACHED_PHOTOS} รูป` });
    }
    record.photo_uris = photoUris;
    record.photo_uri = photoUris[0] || '';
  }
  if (entityName === 'LoanRecord') {
    const quantity = Number(record.quantity);
    if (!record.asset_id || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'รายการยืมหรือจำนวนไม่ถูกต้อง' });
    }
    const borrowerFields = [
      ['borrower_name', 'ชื่อ-นามสกุล'],
      ['borrower_department', 'แผนก/ฝ่าย'],
      ['borrower_building', 'ตึก'],
      ['borrower_phone', 'เบอร์โทร'],
      ['borrow_date', 'วันที่ยืม'],
      ['due_date', 'กำหนดวันที่คืน'],
    ];
    const missingBorrowerField = borrowerFields.find(([field]) => !String(record[field] || '').trim());
    if (missingBorrowerField) {
      return res.status(400).json({ error: `กรุณากรอก${missingBorrowerField[1]}` });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.borrow_date)
      || !/^\d{4}-\d{2}-\d{2}$/.test(record.due_date)
      || record.due_date < record.borrow_date) {
      return res.status(400).json({ error: 'วันที่ยืมหรือกำหนดคืนไม่ถูกต้อง' });
    }
    record.borrower_user_id = req.user.id;
    record.borrower_name = String(record.borrower_name).trim();
    record.borrower_signature = record.borrower_name;
    record.borrower_department = String(record.borrower_department).trim();
    record.borrower_building = String(record.borrower_building).trim();
    record.borrower_phone = String(record.borrower_phone).trim();
    record.status = 'รออนุมัติยืม';
    record.loan_requested_at = new Date().toISOString();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [assetRows] = await connection.execute(
        'SELECT data FROM entity_records WHERE entity_name = ? AND id = ? FOR UPDATE',
        ['Asset', record.asset_id],
      );
      if (!assetRows.length) {
        const error = new Error('ไม่พบสินทรัพย์ที่ต้องการยืม');
        error.status = 404;
        throw error;
      }
      const asset = typeof assetRows[0].data === 'string' ? JSON.parse(assetRows[0].data) : assetRows[0].data;
      if (asset.condition === 'ซ่อมไม่ได้' || asset.keep_for_study === 'เก็บ' || Number(asset.available_quantity) < quantity) {
        const error = new Error('สินทรัพย์ไม่พร้อมให้ยืมหรือมีจำนวนไม่เพียงพอ');
        error.status = 409;
        throw error;
      }
      const updatedAsset = {
        ...asset,
        available_quantity: Number(asset.available_quantity) - quantity,
        updated_date: new Date().toISOString(),
      };
      await connection.execute(
        'UPDATE entity_records SET data = ? WHERE entity_name = ? AND id = ?',
        [JSON.stringify(updatedAsset), 'Asset', record.asset_id],
      );
      await connection.execute(
        'INSERT INTO entity_records (entity_name, id, data, created_by_id) VALUES (?, ?, ?, ?)',
        [entityName, record.id, JSON.stringify(record), req.user.id],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } else {
    await pool.execute(
      'INSERT INTO entity_records (entity_name, id, data, created_by_id) VALUES (?, ?, ?, ?)',
      [entityName, record.id, JSON.stringify(record), req.user.id],
    );
  }
  res.status(201).json(record);
}));

app.patch('/api/entities/:entityName/:id', asyncRoute(async (req, res) => {
  const { entityName, id } = req.params;
  if (entityName === 'Asset' && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขสินทรัพย์ได้' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT data FROM entity_records WHERE entity_name = ? AND id = ? FOR UPDATE',
      [entityName, id],
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการ' });
    }
    const current = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    if (entityName === 'LoanRecord') {
      const allowedFields = new Set(['return_request_date', 'return_photo_uris', 'return_photo_uri', 'return_signature', 'return_note', 'status']);
      const requestedFields = Object.keys(req.body || {});
      if (!isAdmin(req.user) && !ownsLoan(current, req.user)) {
        await connection.rollback();
        return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการ' });
      }
      if (isAdmin(req.user) && requestedFields.includes('status')) {
        await connection.rollback();
        return res.status(403).json({ error: 'กรุณาใช้คำสั่งอนุมัติหรือปฏิเสธรายการ' });
      }
      if (!isAdmin(req.user) && (current.status !== 'กำลังยืม'
        || req.body?.status !== 'รออนุมัติคืน'
        || !req.body?.return_request_date
        || !req.body?.return_signature
        || requestedFields.some((field) => !allowedFields.has(field)))) {
        await connection.rollback();
        return res.status(403).json({ error: 'ไม่สามารถแก้ไขรายการนี้ได้' });
      }
    }
    const updated = { ...current, ...req.body, id, updated_date: new Date().toISOString() };
    if (entityName === 'Asset') {
      const photoUris = normalizePhotoUris(updated.photo_uris, updated.photo_uri);
      if (photoUris.length > MAX_ATTACHED_PHOTOS) {
        await connection.rollback();
        return res.status(400).json({ error: `แนบรูปสินทรัพย์ได้สูงสุด ${MAX_ATTACHED_PHOTOS} รูป` });
      }
      updated.photo_uris = photoUris;
      updated.photo_uri = photoUris[0] || '';
    }
    if (entityName === 'LoanRecord' && !isAdmin(req.user)) {
      const returnPhotoUris = normalizePhotoUris(updated.return_photo_uris, updated.return_photo_uri);
      if (returnPhotoUris.length > MAX_ATTACHED_PHOTOS) {
        await connection.rollback();
        return res.status(400).json({ error: `แนบรูปตอนคืนได้สูงสุด ${MAX_ATTACHED_PHOTOS} รูป` });
      }
      updated.return_photo_uris = returnPhotoUris;
      updated.return_photo_uri = returnPhotoUris[0] || '';
    }
    if (entityName === 'Asset' && !String(updated.asset_name || '').trim()) {
      await connection.rollback();
      return res.status(400).json({ error: 'กรุณากรอกชื่อสินทรัพย์' });
    }
    await connection.execute(
      'UPDATE entity_records SET data = ? WHERE entity_name = ? AND id = ?',
      [JSON.stringify(updated), entityName, id],
    );
    await connection.commit();
    res.json(updated);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.delete('/api/entities/:entityName/:id', asyncRoute(async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบข้อมูลได้' });
  }
  const [result] = await pool.execute('DELETE FROM entity_records WHERE entity_name = ? AND id = ?', [req.params.entityName, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการ' });
  res.json({ success: true });
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      .json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'รูปภาพต้องมีขนาดไม่เกิน 8 MB' : 'อัปโหลดไฟล์ไม่สำเร็จ' });
  }
  res.status(error.status || 500).json({ error: error.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
});

async function start() {
  await initializeDatabase();
  app.listen(port, () => console.log(`Itemgo API listening at http://localhost:${port} (MySQL)`));
}

start().catch((error) => {
  console.error('Could not connect to MySQL. Check the MYSQL_* values in .env.', error.message);
  process.exit(1);
});
