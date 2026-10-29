import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'itemgo',
});
const key = crypto.randomUUID();
const user = { id: crypto.randomUUID(), email: `admin-ui-${key}@example.test`, password: `UiCheck-${crypto.randomBytes(5).toString('hex')}` };
const assetId = crypto.randomUUID();
const loanId = crypto.randomUUID();
const now = new Date().toISOString();
try {
  await pool.execute(
    'INSERT INTO users (id,email,password_hash,full_name,department,building,role) VALUES (?,?,?,?,?,?,?)',
    [user.id,user.email,await bcrypt.hash(user.password,4),'ผู้ดูแลทดสอบ','ฝ่ายระบบ','อาคารทดสอบ','admin'],
  );
  const asset = { id: assetId, asset_name: 'เครื่องทดสอบตาราง', asset_code: `UI-${key.slice(0,8)}`, brand: 'Demo', model: 'Test', total_quantity: 1, available_quantity: 0, condition: 'ไม่ชำรุด', keep_for_study: 'ไม่เก็บ' };
  const loan = { id: loanId, asset_id: assetId, asset_name: asset.asset_name, asset_code: asset.asset_code, borrower_user_id: crypto.randomUUID(), borrower_name: 'ผู้ยืมทดสอบ', borrower_department: 'แผนก QA', borrower_building: 'ตึก 2', borrower_phone: '0800000000', quantity: 1, borrow_date: '2026-10-09', due_date: '2026-10-16', status: 'กำลังยืม', lender_name: 'ผู้อนุมัติทดสอบ', borrower_signature: '', lender_signature: 'data:image/png;base64,lender', borrow_photo_uris: ['/test/pre-1.jpg','/test/pre-2.jpg'], borrow_photo_uri: '/test/pre-1.jpg', return_photo_uris: ['/test/return-1.jpg','/test/return-2.jpg'], return_photo_uri: '/test/return-1.jpg', return_signature: 'data:image/png;base64,return', created_date: now, updated_date: now, created_by_id: user.id };
  await pool.execute('INSERT INTO entity_records (entity_name,id,data,created_by_id) VALUES (?,?,?,?)',['Asset',assetId,JSON.stringify(asset),user.id]);
  await pool.execute('INSERT INTO entity_records (entity_name,id,data,created_by_id) VALUES (?,?,?,?)',['LoanRecord',loanId,JSON.stringify(loan),user.id]);
  console.log(JSON.stringify({ email: user.email, password: user.password, userId: user.id, assetId, loanId }, null, 2));
} finally {
  await pool.end();
}
