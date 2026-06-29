/**
 * Coffee Dashboard — live data API (Google Apps Script Web App)
 * แหล่งข้อมูลเรียลไทม์สำหรับ index.html — อ่านชีตสดทุกครั้งที่เรียก (ไม่ติดแคช Publish-to-web)
 *
 * ── วิธี deploy ──
 * 1. เปิด Google Sheet ของร้าน → เมนู Extensions ▸ Apps Script
 * 2. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ลงไป → กด Save
 * 3. กด Deploy ▸ New deployment ▸ เลือก type = Web app
 *      - Execute as:      Me (อีเมลของคุณ)
 *      - Who has access:  Anyone        ← ต้องเป็น Anyone ให้ทุกคนเปิดแดชบอร์ดได้
 * 4. กด Deploy → อนุญาตสิทธิ์ → คัดลอก "Web app URL" (ลงท้ายด้วย /exec)
 * 5. เอา URL นั้นไปวางใน index.html ที่ตัวแปร  API_URL
 *
 * หมายเหตุ: ถ้าแก้โค้ดนี้ภายหลัง ต้องกด Deploy ▸ Manage deployments ▸ Edit ▸ New version
 *           มิฉะนั้น /exec จะยังรันโค้ดเวอร์ชันเก่า
 *
 * ตอบกลับเป็น JSON: { rows, issues, found, maxNo }
 *   rows   = [{ cus, p, t, k, pr, q }]   แถวที่ถูกต้อง
 *   issues = [{ raw, code, val }]        แถวที่ "ดูเหมือนข้อมูล" แต่ค่าผิด (ไม่นับ แต่แจ้งเตือน)
 *   found  = จำนวนแถวที่ดูเหมือนข้อมูลทั้งหมด
 *   maxNo  = เลขลำดับสูงสุดในคอลัมน์ No (ใช้ตรวจว่าอ่านครบไหม)
 */

// ตั้งค่าได้ตามต้องการ — ถ้า script ผูกกับชีตอยู่แล้ว ปล่อยว่างได้
var SHEET_ID = '';            // '' = ใช้ชีตที่ script ผูกอยู่ · หรือใส่ ID ชีตเพื่อระบุไฟล์เจาะจง
var SHEET_NAME = '';          // '' = เลือกแท็บตาม GID ด้านล่าง · หรือใส่ชื่อแท็บตรง ๆ
var GID = 756749038;          // GID ของแท็บที่ใช้ (ตรงกับลิงก์ publish เดิม) · 0 = แท็บแรก

var PRODUCTS = ['เอสเพรสโซ', 'อเมริกาโน่', 'ลาเต้', 'คาปูชิโน่', 'มอคค่า'];
var TYPES = ['hot', 'ice'];
var TAKES = ['for here', 'to go'];

function doGet() {
  var payload;
  try {
    payload = readOrders();
  } catch (err) {
    payload = { rows: [], issues: [], found: 0, maxNo: 0, error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ────────────────────────────────────────────────────────────────────────
 * Realtime push (webhook ออกจากชีต → Firebase → แดชบอร์ด)
 * ────────────────────────────────────────────────────────────────────────
 * เมื่อมีการแก้ชีต ทริกเกอร์ onChange จะยิง onSheetChange() ซึ่งเขียน "สัญญาณ"
 * ไปยัง Firebase Realtime Database โหนด /signal · index.html ฟังโหนดนี้แล้ว
 * ดึงข้อมูลใหม่ทันที (ดูฟังก์ชัน realtime ใน index.html)
 *
 * ── ตั้งค่าครั้งเดียว ──
 * 1) Project Settings ⚙ ▸ Script properties ▸ Add script property:
 *      FIREBASE_DB_URL = https://<project>-default-rtdb.<region>.firebasedatabase.app
 *      FIREBASE_SECRET = <database secret> (Firebase ▸ Project settings ▸ Service accounts ▸ Database secrets)
 *    (เก็บใน Script properties เท่านั้น — ห้ามใส่ในซอร์สหรือฝั่งเบราว์เซอร์)
 * 2) รัน installTrigger() หนึ่งครั้งจากเอดิเตอร์ → อนุญาตสิทธิ์ → ผูกทริกเกอร์ onChange ให้อัตโนมัติ
 *    (ต้องเป็น installable trigger — simple trigger เรียก UrlFetchApp ไม่ได้)
 * 3) ตั้ง Realtime Database Rules ให้ /signal อ่านได้สาธารณะ เขียนไม่ได้:
 *      { "rules": { "signal": { ".read": true, ".write": false } } }
 *    (การเขียนจาก Apps Script ใช้ secret ซึ่ง bypass rules อยู่แล้ว)
 */

// ทริกเกอร์ onChange เรียกฟังก์ชันนี้เมื่อชีตเปลี่ยน (แก้/เพิ่ม/ลบแถว)
function onSheetChange(e) {
  pushSignal_();
}

// เขียนสัญญาณ {v,n,t} ไปยัง Firebase /signal — ไม่ส่งข้อมูลธุรกิจ มีแค่เวอร์ชัน/เวลา
function pushSignal_() {
  var props = PropertiesService.getScriptProperties();
  var dbUrl = props.getProperty('FIREBASE_DB_URL');
  var secret = props.getProperty('FIREBASE_SECRET');
  if (!dbUrl || !secret) {
    throw new Error('ยังไม่ได้ตั้งค่า — เพิ่ม FIREBASE_DB_URL และ FIREBASE_SECRET ใน Script properties');
  }
  var data = readOrders();
  var url = dbUrl.replace(/\/+$/, '') + '/signal.json?auth=' + encodeURIComponent(secret);
  var payload = JSON.stringify({ v: data.maxNo, n: data.rows.length, t: Date.now() });
  var resp = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true,
  });
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Firebase ตอบกลับ ' + code + ': ' + resp.getContentText().slice(0, 300));
  }
}

// รันครั้งเดียวจากเอดิเตอร์ — สร้าง installable onChange trigger (ลบของเดิมกันซ้ำ)
function installTrigger() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet bound — set SHEET_ID');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onSheetChange') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onChange().create();
  pushSignal_(); // ยิงสัญญาณแรกทันทีเพื่อทดสอบว่าตั้งค่าครบ
}

function getSheet() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet bound — set SHEET_ID');
  if (SHEET_NAME) return ss.getSheetByName(SHEET_NAME);
  if (GID) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === GID) return sheets[i];
    }
  }
  return ss.getSheets()[0];
}

function readOrders() {
  var rows = [], issues = [];
  var found = 0, maxNo = 0;
  var values = getSheet().getDataRange().getValues();

  for (var r = 0; r < values.length; r++) {
    var cells = values[r].map(function (c) {
      return (c === null || c === undefined) ? '' : String(c).trim();
    });

    // แสดงแต่ละคอลัมน์คั่นด้วย " | " (ตัดคอลัมน์ว่างท้ายแถวออก) เพื่ออ่านง่ายในข้อความแจ้งเตือน
    var trimmed = cells.slice();
    while (trimmed.length && trimmed[trimmed.length - 1] === '') trimmed.pop();
    var snippet = trimmed.join(' | ').slice(0, 200);

    // ยึดคอลัมน์ Product/Type/take จากเนื้อหา แล้วหาคอลัมน์อื่นจากตำแหน่งสัมพัทธ์
    // ลำดับมาตรฐาน: [No, Cus, Product, Type, take, Order, Price]
    var pi = indexOfMember(cells, PRODUCTS);
    var ti = indexOfMember(cells, TYPES);
    var ki = indexOfMember(cells, TAKES);
    if (pi < 0 && ti < 0 && ki < 0) {
      // ไม่พบ Product/Type/take — แจ้งเตือน "ไม่ครบ" สำหรับทุกแถวที่มีข้อมูลจริง (มีตัวเลขอย่างน้อยหนึ่งช่อง)
      // ข้ามเฉพาะหัวตาราง (ข้อความล้วน ไม่มีตัวเลข) และบรรทัดว่าง
      // หมายเหตุ: แถวสรุปยอด (มีตัวเลขรวม) จะถูกนับเป็น "ไม่ครบ" ด้วย — เอาตารางสรุปออกจากชีตถ้าไม่ต้องการให้แจ้ง
      if (/[0-9]/.test(trimmed.join(''))) {
        found++;
        var noMaybe = parseInt(cells[0], 10);
        if (!isNaN(noMaybe) && noMaybe > maxNo) maxNo = noMaybe;
        issues.push({ raw: snippet, code: 'incomplete' });
      }
      continue;
    }
    var base = pi >= 0 ? pi : (ti >= 0 ? ti - 1 : ki - 2);     // index ของคอลัมน์ Product
    if (base < 0) continue;

    found++;
    var noNum = parseInt(cells[0], 10);
    if (!isNaN(noNum) && noNum > maxNo) maxNo = noNum;

    var cus = base - 1 >= 0 ? cells[base - 1] : '?';
    var product = cells[base], type = cells[base + 1], take = cells[base + 2];
    var order = cells[base + 3], price = cells[base + 4];

    if (price === undefined || price === '' || type === undefined || take === undefined) { issues.push({ raw: snippet, code: 'incomplete' }); continue; }
    if (PRODUCTS.indexOf(product) < 0) { issues.push({ raw: snippet, code: 'product', val: product }); continue; }
    if (TYPES.indexOf(type) < 0) { issues.push({ raw: snippet, code: 'type', val: type }); continue; }
    if (TAKES.indexOf(take) < 0) { issues.push({ raw: snippet, code: 'service', val: take }); continue; }
    var pr = parseInt(price, 10);
    if (isNaN(pr)) { issues.push({ raw: snippet, code: 'price', val: price }); continue; }
    // คอลัมน์เกิน: มีข้อมูลหลังคอลัมน์ราคา (base+4) → ถือว่าผิดรูปแบบ ไม่นับ
    var hasExtra = false;
    for (var ce = base + 5; ce < cells.length; ce++) { if (cells[ce] !== '') { hasExtra = true; break; } }
    if (hasExtra) { issues.push({ raw: snippet, code: 'extra' }); continue; }
    var q = parseInt(order, 10) || 1;
    rows.push({ cus: cus || '?', p: product, t: type, k: take, pr: pr, q: q });
  }
  return { rows: rows, issues: issues, found: found, maxNo: maxNo };
}

function indexOfMember(cells, set) {
  for (var i = 0; i < cells.length; i++) {
    if (set.indexOf(cells[i]) >= 0) return i;
  }
  return -1;
}
