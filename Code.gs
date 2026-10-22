/**
 * 찾아가는 청년센터 x배너 투표 - Google Apps Script 백엔드
 *
 * 시트 구조 (시트 이름: votes)
 *   A열: 시안 번호(1~4) / B열: 득표수
 *   첫 실행 시 자동으로 생성됩니다.
 *
 * 관리자 비밀번호
 *   프로젝트 설정 → 스크립트 속성 → ADMIN_PASSWORD 에 저장
 */
const SHEET_NAME = 'votes';
const OPTIONS = [1, 2, 3, 4];

function doGet(e) {
  return json({ ok: true, counts: getCounts() });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');

    if (body.action === 'admin') {
      const password = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
      if (!password || body.password !== password) {
        return json({ ok: false, error: 'unauthorized' });
      }
      return json({ ok: true, counts: getCounts() });
    }

    const option = Number(body.option);
    if (body.action !== 'vote' || OPTIONS.indexOf(option) === -1) {
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

    return json({ ok: true, counts: getCounts() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

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
