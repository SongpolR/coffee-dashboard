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

    // ยึดคอลัมน์ Product/Type/take จากเนื้อหา แล้วหาคอลัมน์อื่นจากตำแหน่งสัมพัทธ์
    // ลำดับมาตรฐาน: [No, Cus, Product, Type, take, Order, Price]
    var pi = indexOfMember(cells, PRODUCTS);
    var ti = indexOfMember(cells, TYPES);
    var ki = indexOfMember(cells, TAKES);
    if (pi < 0 && ti < 0 && ki < 0) continue;                 // หัวตาราง/เส้นคั่น/ตารางสรุป → ข้าม
    var base = pi >= 0 ? pi : (ti >= 0 ? ti - 1 : ki - 2);     // index ของคอลัมน์ Product
    if (base < 0) continue;

    found++;
    var noNum = parseInt(cells[0], 10);
    if (!isNaN(noNum) && noNum > maxNo) maxNo = noNum;
    var snippet = cells.join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);

    var cus = base - 1 >= 0 ? cells[base - 1] : '?';
    var product = cells[base], type = cells[base + 1], take = cells[base + 2];
    var order = cells[base + 3], price = cells[base + 4];

    if (price === undefined || price === '' || type === undefined || take === undefined) { issues.push({ raw: snippet, code: 'incomplete' }); continue; }
    if (PRODUCTS.indexOf(product) < 0) { issues.push({ raw: snippet, code: 'product', val: product }); continue; }
    if (TYPES.indexOf(type) < 0) { issues.push({ raw: snippet, code: 'type', val: type }); continue; }
    if (TAKES.indexOf(take) < 0) { issues.push({ raw: snippet, code: 'service', val: take }); continue; }
    var pr = parseInt(price, 10);
    if (isNaN(pr)) { issues.push({ raw: snippet, code: 'price', val: price }); continue; }
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
