/**
 * 찾아가는 청년센터 x배너 투표 - Google Apps Script 백엔드
 *
 * 시트 구조 (시트 이름: votes)
 *   A열: 시안 번호(1~4) / B열: 득표수
 *   첫 실행 시 자동으로 생성됩니다.
 *
 * 관리자 비밀번호
 *   프로젝트 설정 → 스크립트 속성 → ADMIN_PASSWORD 에 저장
 *
 * 결과 열람
 *   투표하거나 관리자 비밀번호를 확인하면 서명된 토큰을 발급하고,
 *   그 토큰이 있어야만 집계를 돌려줍니다. (투표 전에는 결과 비공개)
 */
const SHEET_NAME = 'votes';
const OPTIONS = [1, 2, 3, 4];

function doGet(e) {
  return json({ ok: false, error: 'use POST' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');

    if (body.action === 'vote') return vote(Number(body.option));
    if (body.action === 'admin') return admin(body.password);
    if (body.action === 'results') {
      if (!verifyToken(body.token)) return json({ ok: false, error: 'unauthorized' });
      return json({ ok: true, counts: getCounts() });
    }
    return json({ ok: false, error: 'invalid action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function vote(option) {
  if (OPTIONS.indexOf(option) === -1) {
    return json({ ok: false, error: 'invalid option' });
  }

  // 동시 투표 시 카운트가 꼬이지 않도록 잠금
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const cell = sheet.getRange(option + 1, 2);
    cell.setValue((Number(cell.getValue()) || 0) + 1);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return json({ ok: true, counts: getCounts(), token: issueToken() });
}

function admin(password) {
  const saved = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!saved || password !== saved) {
    return json({ ok: false, error: 'unauthorized' });
  }
  return json({ ok: true, counts: getCounts(), token: issueToken() });
}

// ---------- 토큰 (HMAC 서명, 별도 저장소 불필요) ----------
function getSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('TOKEN_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', secret);
  }
  return secret;
}

function sign(nonce) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(nonce, getSecret()));
}

function issueToken() {
  const nonce = Utilities.getUuid();
  return nonce + '.' + sign(nonce);
}

function verifyToken(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 2 && sign(parts[0]) === parts[1];
}

// ---------- 시트 ----------
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['시안', '득표수']]);
    sheet.getRange(2, 1, OPTIONS.length, 2).setValues(OPTIONS.map((n) => [n, 0]));
  }
  return sheet;
}

function getCounts() {
  const values = getSheet().getRange(2, 1, OPTIONS.length, 2).getValues();
  const counts = {};
  values.forEach((row) => (counts[row[0]] = Number(row[1]) || 0));
  return counts;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
