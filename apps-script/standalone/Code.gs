/**
 * Coffee Dashboard — self-contained Google Apps Script Web App
 * ══════════════════════════════════════════════════════════════════════════
 * ทางเลือกที่ "ทุกอย่างอยู่ใน Apps Script" ของแดชบอร์ดบน GitHub Pages เดิม
 * (เวอร์ชัน GitHub ยังอยู่ครบ — โฟลเดอร์นี้เป็นบิลด์คู่ขนาน ไม่แตะของเดิม)
 *
 * โปรเจกต์นี้ทำ 3 อย่างในที่เดียว ไม่พึ่ง Firebase / Cloud Function:
 *   1) doGet()              → เสิร์ฟหน้าเว็บ (Index/Styles/Config/App) ผ่าน HtmlService
 *   2) getOrders()          → อ่านชีตสด คืน JSON ให้หน้าเว็บผ่าน google.script.run
 *   3) getAiRecommendation()→ พร็อกซีเรียก Claude (คีย์อยู่ใน Script properties เท่านั้น)
 *
 * ── realtime ──
 *   Apps Script ผลักข้อมูลเข้าเบราว์เซอร์ไม่ได้ (ไม่มี websocket/SSE) เวอร์ชันนี้จึงใช้
 *   "polling ทุก 15 วิ" ที่ app.jsx มีอยู่แล้วเป็น fallback — ใกล้เคียง realtime สำหรับแดชบอร์ด
 *
 * ── deploy (ครั้งเดียว) ──
 *   ดูขั้นตอนละเอียดใน README-appsscript.md (เมนู Extensions ▸ Apps Script → วางไฟล์ทั้งหมด
 *   → ตั้ง Script property ANTHROPIC_API_KEY → Deploy ▸ New deployment ▸ Web app,
 *   Execute as = Me, Who has access = Anyone → เปิดลิงก์ /exec)
 */

// ── การเลือกชีต (ปุ่มปรับเหมือน apps-script/Code.gs เดิม) ──
var SHEET_ID = '';            // '' = ใช้ชีตที่ script ผูกอยู่ · หรือใส่ ID ชีตเพื่อระบุไฟล์เจาะจง
var SHEET_NAME = '';          // '' = เลือกแท็บตาม GID ด้านล่าง · หรือใส่ชื่อแท็บตรง ๆ
var GID = 756749038;          // GID ของแท็บที่ใช้ · 0 = แท็บแรก

var PRODUCTS = ['เอสเพรสโซ', 'อเมริกาโน่', 'ลาเต้', 'คาปูชิโน่', 'มอคค่า'];
var TYPES = ['hot', 'ice'];
var TAKES = ['for here', 'to go'];

// ── AI (Anthropic) — เทียบเท่า functions/index.js เดิม แต่เรียกผ่าน UrlFetchApp ──
var AI_MODEL = 'claude-haiku-4-5';
var AI_ENDPOINT = 'https://api.anthropic.com/v1/messages';
var AI_VERSION = '2023-06-01';
var AI_COOLDOWN_MS = 180000;  // 3 นาที/ผู้ใช้ (เท่ากับ Cloud Function เดิม)
var AI_CACHE_TTL_S = 21600;   // แคชคำแนะนำ 6 ชม. (เพดาน CacheService) — คีย์ด้วย hash ของข้อมูล

var AI_SYSTEM_PROMPT = [
  "You are a retail analytics advisor for a coffee shop's decision-support dashboard.",
  'You are given statistics that have ALREADY been computed from the point-of-sale data.',
  'Rules:',
  '- Interpret the numbers you are given. NEVER invent, recompute, or assume figures that are not provided.',
  '- Every recommendation must reference a specific figure from the input that motivates it.',
  '- Be concrete and actionable — things the owner can do this week (menu, pricing, staffing, promotions).',
  '- Keep each recommendation to 1-2 sentences.',
  '- Write ALL text in {language}.'
].join('\n');

/* ────────────────────────────────────────────────────────────────────────
 * 1) Web app entry — เสิร์ฟหน้าเว็บ
 * ──────────────────────────────────────────────────────────────────────── */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('แดชบอร์ดยอดขายร้านกาแฟ')
    // สำคัญสำหรับจอเล็ก: ต้องตั้ง viewport บน "หน้านอก" ที่ครอบ iframe ด้วย
    // meta viewport ใน Index.html มีผลแค่ภายใน iframe — ไม่พอ ทำให้มือถือย่อทั้งหน้าให้เล็ก
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ให้ Index.html ฝังไฟล์ย่อย (Styles/Config/App) ด้วย <?!= include('ชื่อไฟล์') ?>
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ────────────────────────────────────────────────────────────────────────
 * 2) Data — อ่านชีตสด (หน้าเว็บเรียกผ่าน google.script.run.getOrders)
 * ──────────────────────────────────────────────────────────────────────── */
function getOrders() {
  try {
    return readOrders();
  } catch (err) {
    return { rows: [], issues: [], found: 0, maxNo: 0, error: String(err) };
  }
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

/* ────────────────────────────────────────────────────────────────────────
 * 3) AI Recommendation — พร็อกซีเรียก Claude (คีย์อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น)
 * ──────────────────────────────────────────────────────────────────────── */

// อ่านแคชอย่างเดียว — หน้าเว็บเรียกตอนโหลดเพื่อโชว์คำแนะนำล่าสุดโดยไม่ต้องสร้างใหม่
function getCachedAi(hash, lang) {
  if (!hash) return null;
  var cached = CacheService.getScriptCache().get('ai_' + hash);
  if (!cached) return null;
  try {
    var v = JSON.parse(cached);
    if (v && v.lang === (lang === 'th' ? 'th' : 'en')) return v;
  } catch (e) { /* แคชเสีย — ถือว่าไม่มี */ }
  return null;
}

// สร้างคำแนะนำ — หน้าเว็บเรียกเมื่อผู้ใช้กดปุ่ม (คืน object โครงเดียวกับ Cloud Function เดิม)
function getAiRecommendation(payload) {
  payload = payload || {};
  var hash = String(payload.hash || '');
  var lang = payload.lang === 'th' ? 'th' : 'en';
  var stats = payload.stats;
  if (!hash || !stats || typeof stats !== 'object') {
    return { error: 'badRequest' };
  }

  // มีแคชสำหรับข้อมูลชุดนี้อยู่แล้ว (อาจถูกผู้ใช้อื่นสร้างไว้) → คืนเลย ไม่เปลือง API
  var pre = getCachedAi(hash, lang);
  if (pre) { pre.cached = true; return pre; }

  // จำกัดอัตราต่อผู้ใช้ ก่อนจ่ายค่า API — fail-open ถ้าโครงสร้างพัง (เหมือน Cloud Function เดิม)
  var rl = checkRateLimit_();
  if (!rl.ok) {
    return { error: 'rateLimited', retryAfterSec: rl.retryAfterSec };
  }

  var key = getApiKey_();
  if (!key) return { error: 'notConfigured' };

  var language = lang === 'th' ? 'Thai' : 'English';
  var userMessage =
    'Statistics (already computed — interpret only, do not recompute):\n\n' +
    JSON.stringify(stats, null, 2) +
    '\n\nReturn 3 to 4 recommendations, ordered most to least impactful, each with a short ' +
    'title, a one-sentence detail that cites a specific figure, and a priority of high, ' +
    'medium, or low. Write all text in ' + language + '.' +
    '\n\nReturn ONLY valid minified JSON (no code fences, no prose) with this exact shape: ' +
    '{"summary": string, "recommendations": [{"title": string, "detail": string, "priority": "high"|"medium"|"low"}]}';

  var body = {
    model: AI_MODEL,
    max_tokens: 2048, // ภาษาไทยกินโทเคนมาก — เผื่อไว้ไม่ให้ JSON ถูกตัด
    system: AI_SYSTEM_PROMPT.replace('{language}', language),
    messages: [{ role: 'user', content: userMessage }]
  };

  var resp;
  try {
    resp = UrlFetchApp.fetch(AI_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': AI_VERSION },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
  } catch (e) {
    return { error: 'network', message: String(e) };
  }

  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    return { error: 'upstream', status: code, message: resp.getContentText().slice(0, 300) };
  }

  var text = '';
  try {
    var data = JSON.parse(resp.getContentText());
    var parts = (data && data.content) || [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && parts[i].type === 'text') text += parts[i].text;
    }
  } catch (e) {
    return { error: 'parse' };
  }

  var parsed = safeParseJson_(text);
  var recsArr = parsed && Array.isArray(parsed.recommendations) ? parsed.recommendations : null;
  // ถ้าอ่านไม่ออก/ว่าง (เช่นถูกตัดที่ max_tokens) อย่าแคชขยะ — คืน error ให้หน้าเว็บให้ลองใหม่
  if (!recsArr || recsArr.length === 0) {
    return { error: 'unreadable' };
  }

  var result = {
    summary: String(parsed.summary || '').slice(0, 600),
    recs: recsArr.slice(0, 6).map(function (r) {
      return {
        title: String(r.title || '').slice(0, 120),
        detail: String(r.detail || '').slice(0, 600),
        priority: ['high', 'medium', 'low'].indexOf(r.priority) >= 0 ? r.priority : 'medium'
      };
    }),
    lang: lang,
    model: AI_MODEL,
    generatedAt: Date.now()
  };

  // แคชให้หน้าเว็บอ่านซ้ำ (คีย์ด้วย hash ของข้อมูล → สร้างใหม่เฉพาะเมื่อข้อมูลเปลี่ยน)
  try {
    CacheService.getScriptCache().put('ai_' + hash, JSON.stringify(result), AI_CACHE_TTL_S);
  } catch (e) { /* แคชเต็ม/พัง — ไม่เป็นไร ยังคืนผลได้ */ }

  return result;
}

// ── helpers ──
function getApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') || '';
}

// จำกัดอัตราต่อผู้ใช้ด้วยคีย์ผู้ใช้ชั่วคราวของ Apps Script (ไม่เปิดเผยตัวตน)
// ถ้าไม่มีคีย์ (ผู้ใช้ไม่ล็อกอิน) → ปล่อยผ่าน โดยยังมี cooldown ฝั่งเบราว์เซอร์ (localStorage) คุมอยู่
function checkRateLimit_() {
  var userKey;
  try { userKey = Session.getTemporaryActiveUserKey(); } catch (e) { userKey = ''; }
  if (!userKey) return { ok: true };
  var cache = CacheService.getScriptCache();
  var cacheKey = 'rl_' + userKey;
  var now = Date.now();
  var until = parseInt(cache.get(cacheKey), 10);
  if (until && now < until) {
    return { ok: false, retryAfterSec: Math.ceil((until - now) / 1000) };
  }
  cache.put(cacheKey, String(now + AI_COOLDOWN_MS), Math.ceil(AI_COOLDOWN_MS / 1000));
  return { ok: true };
}

// แกะ JSON แบบทนทาน — ตัด ```json … ``` ถ้ามี แล้วลองอีกครั้งด้วยช่วง { … } (เหมือน functions เดิม)
function safeParseJson_(text) {
  var t = String(text || '').trim();
  var fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch (e) { /* ลองต่อ */ }
  var start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch (e2) { /* ยอมแพ้ */ }
  }
  return null;
}
