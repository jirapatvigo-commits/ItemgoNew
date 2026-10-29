import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const api = 'http://localhost:4000/api';
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'itemgo',
});
const testKey = crypto.randomUUID();
const users = [
  { id: crypto.randomUUID(), email: `owner-${testKey}@example.test`, token: crypto.randomBytes(32).toString('base64url') },
  { id: crypto.randomUUID(), email: `other-${testKey}@example.test`, token: crypto.randomBytes(32).toString('base64url') },
];
const assetId = crypto.randomUUID();
let loanId;

async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  return fetch(`${api}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

try {
  for (const [index, user] of users.entries()) {
    await pool.execute(
      'INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.email, await bcrypt.hash('RoleTest-Password-2026', 4), `ทดสอบ ${index + 1}`, 'user'],
    );
    await pool.execute(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR))',
      [crypto.createHash('sha256').update(user.token).digest('hex'), user.id],
    );
  }
  const asset = {
    id: assetId,
    asset_code: `ROLE-${testKey}`,
    available_quantity: 1,
    total_quantity: 1,
    condition: 'Good',
    keep_for_study: 'No',
  };
  await pool.execute(
    'INSERT INTO entity_records (entity_name, id, data) VALUES (?, ?, ?)',
    ['Asset', assetId, JSON.stringify(asset)],
  );

  const loanResponse = await apiRequest('/entities/LoanRecord', {
    token: users[0].token,
    method: 'POST',
    body: {
      asset_id: assetId,
      asset_code: asset.asset_code,
      borrower_name: 'ชื่อปลอมจาก client',
      quantity: 1,
      borrow_date: '2026-10-08',
      due_date: '2026-10-09',
      status: 'กำลังยืม',
    },
  });
  const loan = await loanResponse.json();
  assert.equal(loanResponse.status, 201, JSON.stringify(loan));
  loanId = loan.id;
  assert.equal(loan.borrower_user_id, users[0].id);
  assert.notEqual(loan.borrower_name, 'ชื่อปลอมจาก client');

  const ownerList = await apiRequest('/entities/LoanRecord/filter', {
    token: users[0].token,
    method: 'POST',
    body: { query: {}, options: {} },
  });
  const otherList = await apiRequest('/entities/LoanRecord/filter', {
    token: users[1].token,
    method: 'POST',
    body: { query: {}, options: {} },
  });
  assert.equal((await ownerList.json()).items.length, 1);
  assert.equal((await otherList.json()).items.length, 0);

  const otherRead = await apiRequest(`/entities/LoanRecord/${loanId}`, { token: users[1].token });
  assert.equal(otherRead.status, 404);
  const otherReturn = await apiRequest(`/entities/LoanRecord/${loanId}`, {
    token: users[1].token,
    method: 'PATCH',
    body: { return_date: '2026-10-08', status: 'คืนแล้ว' },
  });
  assert.equal(otherReturn.status, 404);
  const assetEdit = await apiRequest(`/entities/Asset/${assetId}`, {
    token: users[0].token,
    method: 'PATCH',
    body: { available_quantity: 99 },
  });
  assert.equal(assetEdit.status, 403);
  const assetCreate = await apiRequest('/entities/Asset', {
    token: users[0].token,
    method: 'POST',
    body: { asset_code: 'FORBIDDEN' },
  });
  assert.equal(assetCreate.status, 403);

  const ownerReturn = await apiRequest(`/entities/LoanRecord/${loanId}`, {
    token: users[0].token,
    method: 'PATCH',
    body: { return_date: '2026-10-08', return_note: 'test', status: 'คืนแล้ว' },
  });
  assert.equal(ownerReturn.status, 200, await ownerReturn.text());
  const [assetRows] = await pool.execute('SELECT data FROM entity_records WHERE entity_name = ? AND id = ?', ['Asset', assetId]);
  const returnedAsset = typeof assetRows[0].data === 'string' ? JSON.parse(assetRows[0].data) : assetRows[0].data;
  assert.equal(Number(returnedAsset.available_quantity), 1);
  const duplicateReturn = await apiRequest(`/entities/LoanRecord/${loanId}`, {
    token: users[0].token,
    method: 'PATCH',
    body: { return_date: '2026-10-08', status: 'คืนแล้ว' },
  });
  assert.equal(duplicateReturn.status, 403);

  console.log(JSON.stringify({
    ownerLoanVisible: true,
    otherUserLoanCount: 0,
    otherUserReadStatus: otherRead.status,
    otherUserReturnStatus: otherReturn.status,
    ordinaryUserAssetMutationStatus: assetEdit.status,
    ordinaryUserAssetCreateStatus: assetCreate.status,
    returnRestoresStockOnce: Number(returnedAsset.available_quantity),
    duplicateReturnStatus: duplicateReturn.status,
  }, null, 2));
} finally {
  if (loanId) await pool.execute('DELETE FROM entity_records WHERE entity_name = ? AND id = ?', ['LoanRecord', loanId]);
  await pool.execute('DELETE FROM entity_records WHERE entity_name = ? AND id = ?', ['Asset', assetId]);
  for (const user of users) {
    await pool.execute('DELETE FROM sessions WHERE user_id = ?', [user.id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [user.id]);
  }
  await pool.end();
}
