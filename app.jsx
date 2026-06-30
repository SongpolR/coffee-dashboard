const { useState, useMemo, useEffect, useRef, useCallback } = React;
const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, PieChart, Pie, Tooltip, LabelList } = Recharts;


// วาง URL ของ Apps Script Web App (.../exec) ที่ deploy แล้วลงตรงนี้ (ดู apps-script/Code.gs)
const API_URL = (window.APP_CONFIG && window.APP_CONFIG.apiUrl) || "";
// ลิงก์เปิด Google Sheet ต้นทาง (ปุ่มบนหัวแดชบอร์ด)
const SHEET_URL = (window.APP_CONFIG && window.APP_CONFIG.sheetUrl) || "";

const PRODUCTS = ["เอสเพรสโซ", "อเมริกาโน่", "ลาเต้", "คาปูชิโน่", "มอคค่า"];
const PRODUCT_EN = { "เอสเพรสโซ": "Espresso", "อเมริกาโน่": "Americano", "ลาเต้": "Latte", "คาปูชิโน่": "Cappuccino", "มอคค่า": "Mocha" };
const TYPES = ["hot", "ice"];
const TAKES = ["for here", "to go"];

// accents ใช้ร่วมกันสองธีม; neutrals เปลี่ยนตามธีม
const ACCENT = { jade: "#5BB89A", clay: "#E07A4F", plum: "#B98BC9", sky: "#6FA8D6", red: "#D9534F" };
const THEMES = {
  dark: {
    ...ACCENT, gold: "#E0A33E", goldDim: "#7d5e26",
    bg: "#17120E", panel: "#211A14", panel2: "#2A201A", line: "#3B2D23",
    text: "#F0E7DA", muted: "#A89685", dim: "#6E5E50",
    tipBg: "#0e0b08", onAccent: "#1a130b",
  },
  light: {
    ...ACCENT, gold: "#C8821E", goldDim: "#E0B868", clay: "#C9603A", jade: "#3E9E80", sky: "#4A89C0",
    bg: "#FBF7F1", panel: "#FFFFFF", panel2: "#F3ECE2", line: "#E4D9C8",
    text: "#2B2017", muted: "#7A6B5A", dim: "#A8997F",
    tipBg: "#FFFFFF", onAccent: "#FFFFFF",
  },
};

// ── i18n ──
const STR = {
  th: {
    title: "แดชบอร์ดยอดขายร้านกาแฟ",
    subtitle: (r, c) => <>ไฟล์ <code>coffee_data</code> · Google Sheet · {r} รายการ · {c} ลูกค้า</>,
    syncing: "กำลังซิงค์…", syncFail: "ซิงค์ไม่สำเร็จ", syncOk: "ซิงค์กับ Google Sheet แล้ว", syncIdle: "ข้อมูลฝังในแอป (ยังไม่ได้ซิงค์)",
    updated: (a) => `อัปเดตล่าสุด ${a}`, idleHint: "กดซิงค์เพื่อดึงข้อมูลสดจากชีต", rowsWord: "แถว",
    err: { parse: "อ่านข้อมูลไม่สำเร็จ — รูปแบบ JSON ไม่ตรง (เปิดดู debug)", net: "เชื่อมต่อ API ไม่ได้ — ตรวจว่า Apps Script deploy เป็น Web app (Anyone) แล้วลองใหม่" },
    syncNow: "ซิงค์เดี๋ยวนี้", syncingBtn: "กำลังซิงค์", autoLabel: "อัปเดตเรียลไทม์",
    fMenu: "เมนู", fTemp: "อุณหภูมิ", fServe: "รูปแบบ", fPrice: "ราคา",
    all: "ทั้งหมด", hot: "ร้อน", iced: "เย็น", dinein: "ทานที่ร้าน", takeaway: "ซื้อกลับ",
    clear: "ล้างตัวกรอง",
    kSales: "ยอดขายรวม", kCups: "จำนวนแก้ว", kCusts: "ลูกค้า", kAvg: "ราคาเฉลี่ย/แก้ว", kBasket: "ยอดเฉลี่ย/ลูกค้า",
    salesSub: (p) => `${p}% ของยอดทั้งร้าน`, cupsSub: "แก้วที่ขายได้", custsSub: "คนที่ไม่ซ้ำ", avgSub: "ต่อแก้ว", basketSub: "ต่อบิล",
    cSalesByMenu: "ยอดขายตามเมนู", cHiLo: "เรียงจากมากไปน้อย",
    cHotIce: "ร้อน vs เย็น", cShare: "สัดส่วนยอดขาย",
    cServe: "ทานที่ร้าน vs ซื้อกลับ", cPriceDist: "การกระจายตามระดับราคา", cCups: "จำนวนแก้ว", cPriceX: "ราคาต่อแก้ว",
    legIce: "เย็น (ice)", legHot: "ร้อน (hot)", legTakeaway: "ซื้อกลับ (to go)", legDinein: "ทานที่ร้าน (for here)",
    empty: "ไม่มีข้อมูลตรงกับตัวกรอง",
    anaHead: "ผลการดำเนินงาน & ข้อเสนอแนะ", anaSub: "วิเคราะห์จากภาพรวมทั้งร้าน — ไม่ขึ้นกับตัวกรองด้านบน",
    foot: "ดึงข้อมูลสดจาก Google Sheets ผ่าน Apps Script Web App แล้วรวมยอดในแอป · ทุกคนที่เปิดเห็นข้อมูลสด · อัปเดตเรียลไทม์ผ่าน Firebase เมื่อเปิดใช้งาน (มี poll สำรองทุก 60 วินาที)",
    madeBy: "จัดทำโดย", author: "ทรงพล รุ่งสว่าง", emailTip: "อีเมล", ghTip: "GitHub",
    bahtSuffix: " บาท", cupSuffix: " แก้ว",
    dbgHead: (n) => `log จาก connector (${n} ตัวอักษร) — คัดลอกส่งมาให้ผมเพื่อปรับ parser`,
    copy: "คัดลอก log", copied: "คัดลอกแล้ว ✓", hide: "ซ่อน",
    themeTip: "สลับธีมมืด/สว่าง", langTip: "เปลี่ยนภาษา", sheetTip: "เปิด Google Sheet", sheetBtn: "เปิดชีต",
    invTitle: (n) => `พบ ${n} แถวที่อาจไม่ถูกต้อง และถูกข้ามไป`,
    invSub: "แถวเหล่านี้ไม่ถูกนำมาคำนวณ — ตรวจสอบและแก้ไขในชีต",
    invShow: "ดูรายละเอียด", invHide: "ซ่อนรายละเอียด", invMore: (n) => `และอีก ${n} แถว`,
    rProduct: "เมนูไม่รู้จัก", rType: "อุณหภูมิไม่ถูกต้อง", rService: "รูปแบบไม่ถูกต้อง", rPrice: "ราคาไม่ถูกต้อง", rIncomplete: "ข้อมูลไม่ครบคอลัมน์", rExtra: "มีคอลัมน์เกิน",
    gapTitle: (got, max) => `อ่านได้ ${got} แถว แต่เลขลำดับสูงสุดในไฟล์คือ ${max}`,
    gapSub: "อาจมีบางแถวที่อ่านไม่ครบจาก connector — ลองกดซิงค์อีกครั้ง",
    st: {
      head: "การวิเคราะห์เชิงสถิติ (DSS)", sub: "สถิติเชิงพรรณนา การกระจาย ความสัมพันธ์ และตะกร้าสินค้า — ภาพรวมทั้งร้าน",
      descTitle: "ยอดซื้อต่อลูกค้า — สถิติเชิงพรรณนา", descNote: "ตัวแปรอัตราส่วน · หน่วยบาท",
      mean: "ค่าเฉลี่ย (Mean)", median: "มัธยฐาน (Median)", mode: "ฐานนิยม (Mode)", nCust: "จำนวนลูกค้า (n)",
      min: "ต่ำสุด", max: "สูงสุด", range: "พิสัย (Range)", q1: "ควอไทล์ 1 (Q1)", q3: "ควอไทล์ 3 (Q3)",
      iqr: "พิสัยควอไทล์ (IQR)", sd: "ส่วนเบี่ยงเบนมาตรฐาน (SD)", cv: "สัมประสิทธิ์การกระจาย (CV)",
      shape: "ลักษณะการแจกแจง", shapeR: "เบ้ขวา", shapeL: "เบ้ซ้าย", shapeN: "สมมาตร (≈ปกติ)", skewNote: (s) => `ความเบ้ = ${s}`,
      histTitle: "การกระจายยอดซื้อต่อลูกค้า (ฮิสโทแกรม)", histY: "จำนวนลูกค้า", histX: "ยอดซื้อต่อลูกค้า (฿)",
      freqTitle: "ตารางแจกแจงความถี่ตามเมนู", cMenu: "เมนู", cFreq: "ความถี่ (แก้ว)", cPct: "ร้อยละ", cProp: "สัดส่วน", cCum: "สะสม %",
      modeNote: (p) => `ฐานนิยม: ${p} (ขายมากที่สุด)`, total: "รวม",
      chiTitle: "การทดสอบความสัมพันธ์ (ไคสแควร์)", chiObs: "ตารางความถี่จริง (จำนวนแก้ว)",
      sNone: "แทบไม่มีความสัมพันธ์", sWeak: "ความสัมพันธ์อ่อน", sMod: "ความสัมพันธ์ปานกลาง", sStrong: "ความสัมพันธ์สูง",
      sig: "มีนัยสำคัญทางสถิติ (p < 0.05)", nsig: "ไม่มีนัยสำคัญ (p ≥ 0.05)",
      pairPT: "เมนู × อุณหภูมิ", pairTS: "อุณหภูมิ × รูปแบบรับ", pairPS: "เมนู × รูปแบบรับ", otherPairs: "คู่ตัวแปรอื่น ๆ",
      basketTitle: "การวิเคราะห์ตะกร้าสินค้า (กฎความสัมพันธ์)", basketNote: (n) => `จาก ${n} ตะกร้า (ต่อ 1 ลูกค้า) · เรียงตาม lift`,
      bRule: "กฎ (ซื้อ → มักซื้อ)", bSup: "Support", bConf: "Confidence", bLift: "Lift",
      basketEmpty: "ยังไม่พบรูปแบบการซื้อร่วมที่ชัดเจน (ลูกค้าส่วนใหญ่ซื้อเมนูเดียว)",
    },
  },
  en: {
    title: "Coffee Shop Sales Dashboard",
    subtitle: (r, c) => <><code>coffee_data</code> · Google Sheet · {r} orders · {c} customers</>,
    syncing: "Syncing…", syncFail: "Sync failed", syncOk: "Synced with Google Sheet", syncIdle: "Embedded data (not synced yet)",
    updated: (a) => `Updated ${a}`, idleHint: "Press sync to pull live data from the sheet", rowsWord: "rows",
    err: { parse: "Couldn't read the data — unexpected JSON format (see debug)", net: "Can't reach the API — check the Apps Script is deployed as a Web app (Anyone), then retry" },
    syncNow: "Sync now", syncingBtn: "Syncing", autoLabel: "Realtime updates",
    fMenu: "Menu", fTemp: "Temp", fServe: "Service", fPrice: "Price",
    all: "All", hot: "Hot", iced: "Iced", dinein: "Dine-in", takeaway: "Takeaway",
    clear: "Clear filters",
    kSales: "Total sales", kCups: "Cups sold", kCusts: "Customers", kAvg: "Avg per cup", kBasket: "Avg per customer",
    salesSub: (p) => `${p}% of store total`, cupsSub: "cups sold", custsSub: "unique", avgSub: "per cup", basketSub: "per bill",
    cSalesByMenu: "Sales by menu", cHiLo: "high to low",
    cHotIce: "Hot vs Iced", cShare: "share of sales",
    cServe: "Dine-in vs Takeaway", cPriceDist: "Distribution by price", cCups: "cups", cPriceX: "Price per cup",
    legIce: "Iced", legHot: "Hot", legTakeaway: "Takeaway", legDinein: "Dine-in",
    empty: "No data matches the filters",
    anaHead: "Performance & Recommendations", anaSub: "Based on the whole store — independent of the filters above",
    foot: "Reads live Google Sheets data via an Apps Script Web App and aggregates in-app · Everyone sees live data · Realtime updates via Firebase when on (60s safety-net poll)",
    madeBy: "Made by", author: "Songpol Rungsawang", emailTip: "Email", ghTip: "GitHub",
    bahtSuffix: " THB", cupSuffix: " cups",
    dbgHead: (n) => `Connector log (${n} chars) — copy and send it to me to tune the parser`,
    copy: "Copy log", copied: "Copied ✓", hide: "Hide",
    themeTip: "Toggle dark/light", langTip: "Change language", sheetTip: "Open Google Sheet", sheetBtn: "Open Sheet",
    invTitle: (n) => `${n} row${n > 1 ? "s" : ""} look invalid and were skipped`,
    invSub: "These rows aren't counted — review and fix them in the sheet.",
    invShow: "Show details", invHide: "Hide details", invMore: (n) => `and ${n} more`,
    rProduct: "unknown menu", rType: "invalid temperature", rService: "invalid service", rPrice: "invalid price", rIncomplete: "missing columns", rExtra: "extra columns",
    gapTitle: (got, max) => `Read ${got} rows but the highest row number is ${max}`,
    gapSub: "Some rows may not have been fully read from the connector — try syncing again.",
    st: {
      head: "Statistical analysis (DSS)", sub: "Descriptive stats, distribution, association & basket — whole store",
      descTitle: "Spend per customer — descriptive statistics", descNote: "Ratio variable · in THB",
      mean: "Mean", median: "Median", mode: "Mode", nCust: "Customers (n)",
      min: "Min", max: "Max", range: "Range", q1: "Q1 (25th)", q3: "Q3 (75th)",
      iqr: "IQR", sd: "Std. deviation (SD)", cv: "Coeff. of variation (CV)",
      shape: "Distribution shape", shapeR: "Right-skewed", shapeL: "Left-skewed", shapeN: "Symmetric (≈normal)", skewNote: (s) => `skewness = ${s}`,
      histTitle: "Spend-per-customer distribution (histogram)", histY: "customers", histX: "Spend per customer (฿)",
      freqTitle: "Frequency distribution by menu", cMenu: "Menu", cFreq: "Frequency (cups)", cPct: "Percent", cProp: "Proportion", cCum: "Cumulative %",
      modeNote: (p) => `Mode: ${p} (most frequent)`, total: "Total",
      chiTitle: "Association test (Chi-square)", chiObs: "Observed counts (cups)",
      sNone: "negligible association", sWeak: "weak association", sMod: "moderate association", sStrong: "strong association",
      sig: "statistically significant (p < 0.05)", nsig: "not significant (p ≥ 0.05)",
      pairPT: "Menu × Temp", pairTS: "Temp × Service", pairPS: "Menu × Service", otherPairs: "Other variable pairs",
      basketTitle: "Market basket analysis (association rules)", basketNote: (n) => `from ${n} baskets (per customer) · ranked by lift`,
      bRule: "Rule (buy → also buy)", bSup: "Support", bConf: "Confidence", bLift: "Lift",
      basketEmpty: "No strong co-purchase patterns yet (most customers buy a single menu item)",
    },
  },
};

// ── สร้างข้อเสนอแนะแบบไดนามิกจากข้อมูลจริง (อิงภาพรวมทั้งร้าน) ──
function buildRecs(rows, lang) {
  const th = lang === "th";
  const pn = (p) => (lang === "en" ? (PRODUCT_EN[p] || p) : p);
  const n = (x) => Math.round(x).toLocaleString("en-US");
  const B = (x) => "฿" + n(x);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const tLab = (t) => (th ? (t === "ice" ? "เย็น" : "ร้อน") : (t === "ice" ? "iced" : "hot"));

  let totalSales = 0, totalCups = 0; const custs = new Set();
  const prod = {}; PRODUCTS.forEach((p) => prod[p] = { sales: 0, qty: 0, ice: 0, hot: 0 });
  let iceSales = 0, hotSales = 0, toGoSales = 0, fhSales = 0, toGoCups = 0, fhCups = 0;
  const priceCups = {};
  for (const r of rows) {
    const v = r.pr * r.q;
    totalSales += v; totalCups += r.q; custs.add(r.cus);
    if (prod[r.p]) { prod[r.p].sales += v; prod[r.p].qty += r.q; prod[r.p][r.t] += v; }
    if (r.t === "ice") iceSales += v; else hotSales += v;
    if (r.k === "to go") { toGoSales += v; toGoCups += r.q; } else { fhSales += v; fhCups += r.q; }
    priceCups[r.pr] = (priceCups[r.pr] || 0) + r.q;
  }
  const ranked = PRODUCTS.map((p) => ({ p, ...prod[p] })).filter((d) => d.qty > 0).sort((a, b) => b.sales - a.sales);
  if (!ranked.length || !totalCups) return [];
  const hero = ranked[0], worst = ranked[ranked.length - 1];
  const heroType = hero.ice >= hero.hot ? "ice" : "hot";
  const custCount = custs.size || 1;
  const cupsPer = totalCups / custCount, baskPer = totalSales / custCount;
  const iceDom = iceSales >= hotSales, toGoDom = toGoSales >= fhSales;
  const prices = Object.keys(priceCups).map(Number).sort((a, b) => priceCups[b] - priceCups[a]);
  const topPrice = prices[0], topPriceCups = priceCups[topPrice] || 0;
  const nextTier = [50, 60, 70].filter((x) => x > topPrice).sort((a, b) => a - b)[0];
  const target = cupsPer + 0.2, growth = pct(target - cupsPer, cupsPer);

  const recs = [];
  recs.push({ color: "gold",
    stat: `${pct(hero.sales, totalSales)}% ${th ? "ของยอด" : "of sales"}`,
    title: th ? `${pn(hero.p)} คือพระเอก — ส่วนใหญ่เป็นแบบ${tLab(heroType)}` : `${pn(hero.p)} is the hero — mostly ${tLab(heroType)}`,
    body: th
      ? `${pn(hero.p)} ทำยอด ${B(hero.sales)} (สูงสุดในร้าน) จาก ${n(hero.qty)} แก้ว และส่วนใหญ่เป็นแบบ${tLab(heroType)} ควรชูเป็นเมนูซิกเนเจอร์ ออกสูตรพิเศษ และจัดคอมโบกับขนมเพื่อดันยอดต่อบิล`
      : `${pn(hero.p)} leads at ${B(hero.sales)} (top in store) across ${n(hero.qty)} cups, mostly ${tLab(heroType)}. Feature it as a signature, launch special recipes, and bundle with pastries to lift the per-bill total.` });

  const svPct = toGoDom ? pct(toGoSales, totalSales) : pct(fhSales, totalSales);
  recs.push({ color: "sky",
    stat: th ? `${svPct}% ${toGoDom ? "ซื้อกลับ" : "ทานที่ร้าน"}` : `${svPct}% ${toGoDom ? "takeaway" : "dine-in"}`,
    title: th ? `ลูกค้าส่วนใหญ่${toGoDom ? "ซื้อกลับ (to go)" : "ทานที่ร้าน (for here)"}` : `Most customers ${toGoDom ? "order to go" : "dine in"}`,
    body: th
      ? `ยอด${toGoDom ? "ซื้อกลับ" : "ทานที่ร้าน"} ${B(toGoDom ? toGoSales : fhSales)} จาก ${n(toGoDom ? toGoCups : fhCups)} แก้ว ${toGoDom ? "ควรลงทุนกับความเร็วหน้าร้าน จุดรับแยก พรีออเดอร์/เดลิเวอรี และบรรจุภัณฑ์ที่ดี มากกว่าการขยายที่นั่ง" : "ควรลงทุนกับบรรยากาศ ที่นั่ง และประสบการณ์ในร้าน เพื่อให้ลูกค้าอยู่นานและสั่งเพิ่ม"}`
      : `${toGoDom ? "Takeaway" : "Dine-in"} brings ${B(toGoDom ? toGoSales : fhSales)} from ${n(toGoDom ? toGoCups : fhCups)} cups. ${toGoDom ? "Invest in counter speed, a separate pickup point, pre-order/delivery and good packaging rather than more seating." : "Invest in ambience, seating and in-store experience so guests stay longer and order more."}` });

  const tPct = iceDom ? pct(iceSales, totalSales) : pct(hotSales, totalSales);
  recs.push({ color: iceDom ? "jade" : "clay",
    stat: th ? `${tPct}% เป็นเมนู${iceDom ? "เย็น" : "ร้อน"}` : `${tPct}% ${iceDom ? "iced" : "hot"}`,
    title: th ? `เครื่องดื่ม${iceDom ? "เย็น" : "ร้อน"}ครองตลาด` : `${iceDom ? "Iced" : "Hot"} drinks dominate`,
    body: th
      ? `ยอด${iceDom ? "เย็น" : "ร้อน"} ${B(iceDom ? iceSales : hotSales)} เทียบกับ${iceDom ? "ร้อน" : "เย็น"} ${B(iceDom ? hotSales : iceSales)} ${iceDom ? "ควรสต็อกน้ำแข็ง/แก้วเย็นให้พอช่วงพีค ออกเมนูเย็นตามฤดู และตรวจกำลังเครื่องทำน้ำแข็ง" : "ควรเน้นคุณภาพการสกัด/นม อุ่นแก้วก่อนเสิร์ฟ และออกเมนูร้อนพิเศษช่วงอากาศเย็น"}`
      : `${iceDom ? "Iced" : "Hot"} is ${B(iceDom ? iceSales : hotSales)} vs ${iceDom ? "hot" : "iced"} ${B(iceDom ? hotSales : iceSales)}. ${iceDom ? "Keep enough ice and cold cups for peaks, add seasonal iced drinks, and check ice-machine capacity." : "Focus on extraction/milk quality, warm the cups, and add special hot drinks in cooler weather."}` });

  recs.push({ color: "text",
    stat: `฿${topPrice} = ${pct(topPriceCups, totalCups)}% ${th ? "ของบิล" : "of bills"}`,
    title: th ? `ราคา ฿${topPrice} คือจุดสมดุล ใช้ดันอัปเซลล์` : `฿${topPrice} is the sweet spot for upsell`,
    body: th
      ? `แก้วราคา ฿${topPrice} ขายได้ ${n(topPriceCups)} แก้ว มากที่สุด ${nextTier ? `ตั้งคอมโบ/ไซซ์อัปให้ขยับจาก ฿${topPrice} ไป ฿${nextTier} ได้ง่าย เช่น เพิ่มช็อต/ท็อปปิ้ง +฿${nextTier - topPrice} เพิ่มยอดเฉลี่ยต่อแก้วทันที` : `ลองออกเมนูพรีเมียม/ไซซ์พิเศษเหนือ ฿${topPrice} เพื่อยกเพดานราคา`}`
      : `฿${topPrice} cups sell the most at ${n(topPriceCups)} cups. ${nextTier ? `Build combos/size-ups to nudge ฿${topPrice} → ฿${nextTier} (e.g. +฿${nextTier - topPrice} extra shot/topping) to raise the average ticket.` : `Introduce premium/special sizes above ฿${topPrice} to lift the price ceiling.`}` });

  if (worst && worst.p !== hero.p) {
    recs.push({ color: "clay",
      stat: th ? `ต่ำสุด ${B(worst.sales)}` : `lowest ${B(worst.sales)}`,
      title: th ? `${pn(worst.p)} ยอดน้อยสุด — ทบทวนเมนู` : `${pn(worst.p)} is the weakest — review it`,
      body: th
        ? `${pn(worst.p)} ขายได้ ${n(worst.qty)} แก้ว ต่ำกว่าทุกเมนู ลองจับคู่โปรโมชัน ปรับสูตร/ราคา หรือทำเป็นเมนูพิเศษหมุนเวียน หากยังไม่ขยับควรพิจารณาตัดเพื่อลดของเสียและความซับซ้อนหลังบาร์`
        : `${pn(worst.p)} sold ${n(worst.qty)} cups, below every other drink. Try a promo pairing, a recipe/price tweak, or a rotating special; if it stays flat, consider cutting it to reduce waste and bar complexity.` });
  }

  recs.push({ color: "jade",
    stat: th ? `${cupsPer.toFixed(2)} แก้ว/ลูกค้า` : `${cupsPer.toFixed(2)} cups/customer`,
    title: th ? "ดันยอดต่อหัวให้สูงขึ้น" : "Push per-head higher",
    body: th
      ? `เฉลี่ย ${B(baskPer)}/ลูกค้า (${cupsPer.toFixed(2)} แก้ว/คน) ทำโปร 'แก้วที่ 2 ลด' หรือเซ็ตคู่/ขนมจับคู่ ถ้าดันค่าเฉลี่ยขึ้นเป็น ${target.toFixed(1)} แก้ว/คน ยอดรวมจะโตราว ${growth}% โดยไม่ต้องหาลูกค้าใหม่`
      : `Average ${B(baskPer)}/customer (${cupsPer.toFixed(2)} cups each). Run a '2nd cup discount' or pairing sets; lifting to ${target.toFixed(1)} cups/customer grows total revenue ~${growth}% with no new customers.` });

  return recs;
}

const baht = (n) => "฿" + Math.round(n).toLocaleString("en-US");

// อ่าน/เขียนค่าตั้งค่าผู้ใช้ลง localStorage แบบกันพัง (เช่น โหมดส่วนตัว/บล็อกสตอเรจ)
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

async function fetchLiveData() {
  // ดึง JSON สดจาก Google Apps Script Web App — อ่านชีตแบบเรียลไทม์ ไม่ติดแคช Publish-to-web
  const url = API_URL + (API_URL.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now(); // กันแคชฝั่ง browser
  let res;
  try {
    res = await fetch(url, { cache: "no-store", redirect: "follow" });
  } catch (e) {
    throw new Error("NETWORK");
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    const err = new Error("PARSE_FAIL");
    err.sample = "(ตอบกลับไม่ใช่ JSON — ตรวจว่า API_URL ชี้ไปที่ /exec ของ Apps Script)";
    throw err;
  }
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (!rows.length) {
    const err = new Error("PARSE_FAIL");
    err.sample = JSON.stringify(data).slice(0, 4000);
    throw err;
  }
  return { rows, issues: data.issues || [], found: data.found || rows.length, maxNo: data.maxNo || 0 };
}

function summarize(rows, f) {
  const sel = rows.filter((r) =>
    (f.product.length === 0 || f.product.includes(r.p)) &&
    (f.type.length === 0 || f.type.includes(r.t)) &&
    (f.take.length === 0 || f.take.includes(r.k)));
  let cups = 0, sales = 0; const custs = new Set();
  const prod = {}; PRODUCTS.forEach((p) => prod[p] = { name: p, sales: 0, qty: 0 });
  const typ = { hot: 0, ice: 0 }, tak = { "for here": 0, "to go": 0 }, price = {};
  for (const r of sel) {
    const v = r.pr * r.q;
    cups += r.q; sales += v; custs.add(r.cus);
    if (prod[r.p]) { prod[r.p].sales += v; prod[r.p].qty += r.q; }
    if (r.t in typ) typ[r.t] += v;
    if (r.k in tak) tak[r.k] += v;
    price[r.pr] = (price[r.pr] || 0) + r.q;
  }
  return { cups, sales, custCount: custs.size, prod, typ, tak, price };
}

/* ────────────────────────────────────────────────────────────────────────
 * สถิติเชิงพรรณนา & DSS — คำนวณฝั่งเบราว์เซอร์จากข้อมูลทั้งหมด (ภาพรวมทั้งร้าน)
 * ระดับการวัด: เมนู/อุณหภูมิ/รูปแบบ = นามบัญญัติ (nominal) · ราคา/จำนวน/ยอดต่อบิล = อัตราส่วน (ratio)
 * ──────────────────────────────────────────────────────────────────────── */

// ยอดซื้อรวมต่อลูกค้า (ตัวแปรเชิงปริมาณหลักที่ใช้ทำสถิติ)
function customerBills(rows) {
  const m = {};
  for (const r of rows) m[r.cus] = (m[r.cus] || 0) + r.pr * r.q;
  return Object.values(m);
}

// ควอนไทล์แบบ interpolation (type-7 เหมือน Excel PERCENTILE.INC)
function quantileSorted(sorted, p) {
  const n = sorted.length;
  if (!n) return 0;
  if (n === 1) return sorted[0];
  const idx = (n - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

// สถิติเชิงพรรณนาของชุดตัวเลข: กลางข้อมูล + การกระจาย + ความเบ้
function describeStats(values) {
  const n = values.length;
  if (!n) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const median = quantileSorted(sorted, 0.5);
  const q1 = quantileSorted(sorted, 0.25), q3 = quantileSorted(sorted, 0.75);
  const freq = {}; let mode = sorted[0], modeCount = 0;
  for (const x of sorted) { freq[x] = (freq[x] || 0) + 1; if (freq[x] > modeCount) { modeCount = freq[x]; mode = x; } }
  const variance = n > 1 ? values.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  // ความเบ้แบบโมเมนต์ (Fisher–Pearson adjusted) — ตรงกับฟังก์ชัน SKEW ของ Excel
  // ใช้โมเมนต์ที่สามแทนผลต่าง mean−median เพื่อให้จับหางขวา/ค่าผิดปกติได้ถูกต้อง
  const skew = (n > 2 && sd > 0)
    ? (n / ((n - 1) * (n - 2))) * values.reduce((s, x) => s + Math.pow((x - mean) / sd, 3), 0)
    : 0;
  return {
    n, mean, median, mode, min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0],
    q1, q3, iqr: q3 - q1, sd, cv: mean ? (sd / mean) * 100 : 0,
    skew,
  };
}

// ปัดความกว้างช่วงให้เป็นเลขกลม ๆ (1, 2, 2.5, 5, 10 × 10^n) — แบบเดียวกับการเลือกสเกลแกนกราฟ
function niceBinWidth(raw) {
  if (!(raw > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

// จัดกลุ่มเป็นช่วงเท่า ๆ กันสำหรับฮิสโทแกรม โดยใช้ขอบช่วงเป็นเลขกลม (เช่น 50–100, 100–150)
function makeHistogram(values) {
  const n = values.length;
  if (!n) return [];
  const min = Math.min(...values), max = Math.max(...values);
  if (min === max) return [{ label: String(Math.round(min)), count: n }];
  const targetK = Math.min(16, Math.max(6, Math.ceil(Math.sqrt(n))));
  const width = niceBinWidth((max - min) / targetK);
  const start = Math.floor(min / width) * width;          // ขอบล่างปัดลงให้ลงตัวกับความกว้าง
  const end = Math.ceil(max / width) * width;              // ขอบบนปัดขึ้นให้ครอบค่าสูงสุด
  const k = Math.max(1, Math.round((end - start) / width));
  const bins = Array.from({ length: k }, (_, i) => ({ lo: start + i * width, hi: start + (i + 1) * width, count: 0 }));
  for (const x of values) { let i = Math.floor((x - start) / width); if (i >= k) i = k - 1; if (i < 0) i = 0; bins[i].count++; }
  return bins.map((b) => ({ label: Math.round(b.lo) + "–" + Math.round(b.hi), count: b.count }));
}

// ตารางแจกแจงความถี่ตามเมนู (ความถี่ = จำนวนแก้ว) + ค่าฐานนิยม
function productFreq(rows) {
  const cnt = {}; PRODUCTS.forEach((p) => cnt[p] = 0);
  let total = 0;
  for (const r of rows) if (cnt[r.p] != null) { cnt[r.p] += r.q; total += r.q; }
  const ranked = PRODUCTS.map((p) => ({ p, freq: cnt[p] })).filter((d) => d.freq > 0).sort((a, b) => b.freq - a.freq);
  let cum = 0;
  return {
    total,
    rows: ranked.map((d) => { cum += d.freq; return { ...d, pct: total ? (d.freq / total) * 100 : 0, prop: total ? d.freq / total : 0, cumPct: total ? (cum / total) * 100 : 0 }; }),
    mode: ranked.length ? ranked[0].p : null,
  };
}

// ── ค่า p ของไคสแควร์ผ่าน regularized incomplete gamma (Numerical Recipes) ──
function gammln(xx) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = xx, y = xx, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += cof[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function gammp(a, x) { // lower regularized incomplete gamma P(a,x)
  if (x <= 0 || a <= 0) return 0;
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let i = 0; i < 300; i++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-13) break; }
    return sum * Math.exp(-x + a * Math.log(x) - gammln(a));
  }
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-13) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammln(a)) * h;
}
function chiSquarePValue(chi2, df) { return chi2 <= 0 ? 1 : 1 - gammp(df / 2, chi2 / 2); }

// การทดสอบความสัมพันธ์ไคสแควร์ระหว่างตัวแปรเชิงกลุ่ม 2 ตัว (ความถี่ = จำนวนแก้ว) + Cramér's V
function chiSquareTest(rows, getA, getB, catsA, catsB) {
  const ai = {}; catsA.forEach((c, i) => ai[c] = i);
  const bi = {}; catsB.forEach((c, i) => bi[c] = i);
  const O = catsA.map(() => catsB.map(() => 0));
  let n = 0;
  for (const r of rows) { const a = getA(r), b = getB(r); if (ai[a] == null || bi[b] == null) continue; O[ai[a]][bi[b]] += r.q; n += r.q; }
  const rowT = O.map((row) => row.reduce((s, x) => s + x, 0));
  const colT = catsB.map((_, j) => catsA.reduce((s, _2, i) => s + O[i][j], 0));
  let chi2 = 0;
  for (let i = 0; i < catsA.length; i++) for (let j = 0; j < catsB.length; j++) {
    const e = n ? (rowT[i] * colT[j]) / n : 0;
    if (e > 0) chi2 += ((O[i][j] - e) * (O[i][j] - e)) / e;
  }
  const df = (catsA.length - 1) * (catsB.length - 1);
  const kk = Math.min(catsA.length, catsB.length) - 1;
  return { O, rowT, colT, n, chi2, df, p: chiSquarePValue(chi2, df), cramersV: (n > 0 && kk > 0) ? Math.sqrt(chi2 / (n * kk)) : 0 };
}

// Market Basket — กฎความสัมพันธ์ของเมนูภายในตะกร้าของลูกค้าแต่ละราย (support/confidence/lift)
function marketBasket(rows, minCount) {
  const baskets = {};
  for (const r of rows) (baskets[r.cus] || (baskets[r.cus] = new Set())).add(r.p);
  const sets = Object.values(baskets), N = sets.length;
  const single = {}; PRODUCTS.forEach((p) => single[p] = 0);
  const pair = {};
  for (const s of sets) {
    const items = [...s];
    items.forEach((a) => single[a]++);
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const key = items[i] < items[j] ? items[i] + "||" + items[j] : items[j] + "||" + items[i];
      pair[key] = (pair[key] || 0) + 1;
    }
  }
  const minc = minCount || 2, rules = [];
  Object.keys(pair).forEach((key) => {
    const both = pair[key]; if (both < minc) return;
    const [a, b] = key.split("||");
    [[a, b], [b, a]].forEach(([x, y]) => {
      const conf = single[x] ? both / single[x] : 0;
      const lift = single[y] ? conf / (single[y] / N) : 0;
      rules.push({ x, y, support: N ? both / N : 0, confidence: conf, lift, count: both });
    });
  });
  rules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);
  return { nBaskets: N, rules: rules.slice(0, 6) };
}

function CoffeeDashboard() {
  // ธีม: ใช้ค่าที่บันทึกไว้ก่อน · ค่าเริ่มต้น = dark
  const [theme, setTheme] = useState(() => {
    const saved = lsGet("cd_theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  // ภาษา: ใช้ค่าที่บันทึกไว้ก่อน · ถ้ายังไม่เคยเลือก ใช้ภาษาของเบราว์เซอร์ (ไทยถ้าขึ้นต้นด้วย "th")
  const [lang, setLang] = useState(() => {
    const saved = lsGet("cd_lang");
    if (saved === "th" || saved === "en") return saved;
    const nav = (navigator.language || (navigator.languages && navigator.languages[0]) || "").toLowerCase();
    return nav.startsWith("th") ? "th" : "en";
  });
  const T = THEMES[theme];
  const L = STR[lang];
  const pname = (p) => (lang === "en" ? (PRODUCT_EN[p] || p) : p);

  const [rows, setRows] = useState([]);
  const [synced, setSynced] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errCode, setErrCode] = useState("");
  const [errRaw, setErrRaw] = useState("");
  const [debugRaw, setDebugRaw] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);
  const [auto, setAuto] = useState(true); // เรียลไทม์เปิดโดยปริยาย — ผู้เปิดแดชบอร์ดเห็นข้อมูลสดทันที
  const [issues, setIssues] = useState([]);
  const [meta, setMeta] = useState(null);
  const [issuesHidden, setIssuesHidden] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const loading = status === "syncing";
  // โครงร่าง skeleton + shimmer แสดงเฉพาะตอนโหลดครั้งแรก (ยังไม่มีข้อมูล) — การซิงค์ครั้งถัดไปจะโชว์สถานะที่ปุ่มแทน
  const initialLoading = loading && rows.length === 0;

  // ตัวกรองแบบเลือกได้หลายค่า — อาเรย์ว่าง = "ทั้งหมด" (ไม่กรอง)
  const [fProduct, setFProduct] = useState([]);
  const [fType, setFType] = useState([]);
  const [fTake, setFTake] = useState([]);

  const timer = useRef(null);
  const didMount = useRef(false);

  const sync = useCallback(async () => {
    setStatus("syncing"); setErrCode(""); setErrRaw(""); setDebugRaw("");
    try {
      const fresh = await fetchLiveData();
      setRows(fresh.rows); setIssues(fresh.issues || []); setIssuesHidden(false); setIssuesOpen(false);
      setMeta({ valid: fresh.rows.length, found: fresh.found || 0, maxNo: fresh.maxNo || 0 });
      setSynced(true); setLastSync(new Date()); setStatus("ok");
    } catch (e) {
      const m = e.message || String(e);
      if (m === "PARSE_FAIL") setErrCode("parse");
      else if (m === "NETWORK") setErrCode("net");
      else { setErrCode("raw"); setErrRaw(m); }
      if (e.sample) { setDebugRaw(e.sample); setShowDebug(true); }
      setStatus("error");
    }
  }, []);

  const copyDebug = useCallback(() => {
    const text = debugRaw || "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {});
        return;
      }
    } catch (_) {}
    const el = document.getElementById("dbg-pre");
    if (el) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  }, [debugRaw]);

  // seed ครั้งแรกตอนเปิดแดชบอร์ด — ซิงค์เฉพาะเมื่อเรียลไทม์ปิดอยู่
  // (ถ้าเรียลไทม์เปิด เอฟเฟกต์ด้านล่างจะซิงค์ให้เองตอน mount จึงไม่ต้องดึงซ้ำ)
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    if (!auto) sync();
  }, [sync]);

  // อัปเดตเรียลไทม์: ฟังโหนด /signal บน Firebase แล้วซิงค์ทันทีเมื่อชีตเปลี่ยน
  // Apps Script เป็นผู้เขียน /signal ผ่าน webhook (ดู apps-script/Code.gs) — หน้านี้แค่ "ฟัง"
  // ถ้ายังไม่ได้ตั้งค่า Firebase ใน config.js จะถอยไปใช้การ poll ทุก 15 วิ โดยอัตโนมัติ
  useEffect(() => {
    if (!auto) return;
    sync(); // ดึงทันทีเมื่อเปิดสวิตช์
    let ref = null, live = false;
    const cfg = (window.APP_CONFIG && window.APP_CONFIG.firebase);
    const ready = cfg && typeof cfg.databaseURL === "string" &&
      cfg.databaseURL.indexOf("YOUR_") < 0 && window.firebase && window.firebase.database;
    if (ready) {
      try {
        if (!window.firebase.apps.length) window.firebase.initializeApp(cfg);
        ref = window.firebase.database().ref("signal");
        let first = true;
        ref.on("value", () => {
          if (first) { first = false; return; } // snapshot แรก = ค่าปัจจุบัน ไม่ต้องซิงค์ซ้ำ
          sync();
        });
        live = true;
      } catch (e) { live = false; }
    }
    // poll สำรอง: ช้า (60 วิ) เมื่อเรียลไทม์ทำงาน · เร็ว (15 วิ) เมื่อยังไม่ได้ตั้งค่า Firebase
    timer.current = setInterval(sync, live ? 60000 : 15000);
    return () => {
      if (ref) ref.off();
      if (timer.current) clearInterval(timer.current);
    };
  }, [auto, sync]);

  // อัปเดตชื่อแท็บ + แอตทริบิวต์ lang ของหน้าให้ตรงกับภาษาที่เลือก (รองรับ TH/EN)
  useEffect(() => { document.title = L.title; document.documentElement.lang = lang; lsSet("cd_lang", lang); }, [lang, L]);
  useEffect(() => { lsSet("cd_theme", theme); }, [theme]);

  const f = { product: fProduct, type: fType, take: fTake };
  const S = useMemo(() => summarize(rows, f), [rows, fProduct, fType, fTake]);
  const totalSales = useMemo(() => rows.reduce((s, r) => s + r.pr * r.q, 0), [rows]);
  const totalCusts = useMemo(() => new Set(rows.map((r) => r.cus)).size, [rows]);

  const byProduct = useMemo(() =>
    Object.values(S.prod).filter((d) => d.qty > 0).sort((a, b) => b.sales - a.sales)
      .map((d) => ({ ...d, label: pname(d.name) })), [S, lang]);
  const byType = useMemo(() => [
    { name: L.legIce, value: S.typ.ice, fill: T.jade },
    { name: L.legHot, value: S.typ.hot, fill: T.clay },
  ].filter((d) => d.value > 0), [S, T, L]);
  const byTake = useMemo(() => [
    { name: L.legTakeaway, value: S.tak["to go"], fill: T.gold },
    { name: L.legDinein, value: S.tak["for here"], fill: T.sky },
  ].filter((d) => d.value > 0), [S, T, L]);
  const byPrice = useMemo(() => [50, 60, 70].map((p) => ({ name: "฿" + p, value: S.price[p] || 0 })), [S]);

  const avg = S.cups ? S.sales / S.cups : 0;
  const basket = S.custCount ? S.sales / S.custCount : 0;
  const recs = useMemo(() => buildRecs(rows, lang), [rows, lang]);

  // ── สถิติ/DSS — คำนวณจากข้อมูลทั้งหมด (ไม่ขึ้นกับตัวกรอง) ──
  const bills = useMemo(() => customerBills(rows), [rows]);
  const desc = useMemo(() => describeStats(bills), [bills]);
  const hist = useMemo(() => makeHistogram(bills), [bills]);
  const freq = useMemo(() => productFreq(rows), [rows]);
  const chiPT = useMemo(() => chiSquareTest(rows, (r) => r.p, (r) => r.t, PRODUCTS, TYPES), [rows]);
  const chiTS = useMemo(() => chiSquareTest(rows, (r) => r.t, (r) => r.k, TYPES, TAKES), [rows]);
  const chiPS = useMemo(() => chiSquareTest(rows, (r) => r.p, (r) => r.k, PRODUCTS, TAKES), [rows]);
  const mba = useMemo(() => marketBasket(rows), [rows]);
  const chiStrength = (v) => (v < 0.1 ? L.st.sNone : v < 0.2 ? L.st.sWeak : v < 0.4 ? L.st.sMod : L.st.sStrong);
  const num1 = (x) => (Math.round(x * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pNote = (p) => (p < 0.001 ? "p < 0.001" : "p = " + p.toFixed(3));

  const toggleVal = (cur, v) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  const reset = () => { setFProduct([]); setFType([]); setFTake([]); };
  const active = fProduct.length + fType.length + fTake.length;

  // แสดงเป็นวันที่-เวลาที่รีเฟรชจริง แทนข้อความ "กี่วินาที/นาทีที่แล้ว"
  const syncTimeTxt = lastSync
    ? lastSync.toLocaleString(lang === "th" ? "th-TH" : "en-GB",
        { calendar: "gregory", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "";
  const colorOf = (key) => (key === "text" ? T.text : T[key]);
  const reasonText = (it) => {
    const m = { product: L.rProduct, type: L.rType, service: L.rService, price: L.rPrice, incomplete: L.rIncomplete, extra: L.rExtra };
    return m[it.code] + (it.val ? `: "${it.val}"` : "");
  };

  return (
    <div className={"cd-root" + (theme === "light" ? " light" : "")}>

      <header className="cd-head">
        <div className="cd-mark">
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
            <path d="M6 13h17v7a8 8 0 01-8 8h-1a8 8 0 01-8-8v-7z" stroke={T.gold} strokeWidth="1.6"/>
            <path d="M23 15h3a3.5 3.5 0 010 7h-3" stroke={T.gold} strokeWidth="1.6"/>
            <path d="M11 4c-1 1.5-1 3 0 4.5M16 3.5c-1 1.5-1 3 0 4.5" stroke={T.jade} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="cd-titleblock">
          <h1>{L.title}</h1>
          <p>{L.subtitle(rows.length, totalCusts)}</p>
        </div>
        <div className="cd-toggles">
          <button className="icon-btn" title={L.themeTip} aria-label={L.themeTip} onClick={() => setTheme((v) => v === "dark" ? "light" : "dark")}>
            {theme === "dark" ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M21 12.8A8.5 8.5 0 1111.2 3a6.5 6.5 0 009.8 9.8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
            )}
          </button>
          <div className="lang-pill">
            <button className={lang === "th" ? "on" : ""} onClick={() => setLang("th")}>ไทย</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <a className="sheet-btn" href={SHEET_URL} target="_blank" rel="noopener noreferrer" title={L.sheetTip}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M3.5 9h17M9 9v11" stroke="currentColor" strokeWidth="1.7"/></svg>
            <span>{L.sheetBtn}</span>
          </a>
        </div>
      </header>

      <section className="cd-sync">
        <div className="sync-left">
          <span className={"sdot " + status} />
          <div className="sync-txt">
            <strong>{loading ? L.syncing : status === "error" ? L.syncFail : synced ? L.syncOk : L.syncIdle}</strong>
            <small className={status === "error" ? "err" : ""}>
              {status === "error" ? (errCode === "raw" ? errRaw : (L.err[errCode] || L.idleHint))
                : lastSync ? `${L.updated(syncTimeTxt)} · ${rows.length} ${L.rowsWord}`
                : L.idleHint}
            </small>
          </div>
        </div>
        <div className="sync-right">
          <button className="sync-btn" onClick={sync} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={loading ? "spin" : ""}>
              <path d="M21 12a9 9 0 11-3-6.7M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {loading ? L.syncingBtn : L.syncNow}
          </button>
          <label className="toggle">
            <span className="tg-label">{L.autoLabel}</span>
            <span className={"tg" + (auto ? " on" : "")} onClick={() => setAuto((v) => !v)} role="switch" aria-checked={auto}>
              <span className="knob" />
            </span>
          </label>
        </div>
      </section>

      {showDebug && debugRaw ? (
        <section className="cd-debug">
          <div className="dbg-bar">
            <span className="dbg-head">{L.dbgHead(debugRaw.length)}</span>
            <div className="dbg-actions">
              <button className="dbg-btn" onClick={copyDebug}>{copied ? L.copied : L.copy}</button>
              <button className="dbg-btn ghost" onClick={() => setShowDebug(false)}>{L.hide}</button>
            </div>
          </div>
          <pre id="dbg-pre" className="dbg-pre">{debugRaw}</pre>
        </section>
      ) : null}

      {meta && meta.maxNo > meta.found && !issuesHidden ? (
        <section className="cd-info">
          <div className="info-row">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 16.5h.01M10.3 3.9 2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div className="info-txt">
              <strong>{L.gapTitle(meta.found, meta.maxNo)}</strong>
              <small>{L.gapSub}</small>
            </div>
          </div>
        </section>
      ) : null}

      {issues.length > 0 && !issuesHidden ? (
        <section className="cd-info">
          <div className="info-row">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 16.5h.01M10.3 3.9 2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div className="info-txt">
              <strong>{L.invTitle(issues.length)}</strong>
              <small>{L.invSub}</small>
            </div>
            <div className="info-actions">
              <button className="info-btn" onClick={() => setIssuesOpen((o) => !o)}>{issuesOpen ? L.invHide : L.invShow}</button>
              <button className="info-x" aria-label="dismiss" onClick={() => setIssuesHidden(true)}>✕</button>
            </div>
          </div>
          {issuesOpen ? (
            <ul className="info-list">
              {issues.slice(0, 12).map((it, i) => (
                <li key={i}><span className="ic-reason">{reasonText(it)}</span><code>{it.raw}</code></li>
              ))}
              {issues.length > 12 ? <li className="ic-more">{L.invMore(issues.length - 12)}</li> : null}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="cd-filters">
        <div className="seg-wrap">
          <span className="seg-label">{L.fMenu}</span>
          <div className="seg scroll">
            <button className={"seg-btn" + (fProduct.length === 0 ? " on" : "")} onClick={() => setFProduct([])}>{L.all}</button>
            {PRODUCTS.map((p) => (
              <button key={p} className={"seg-btn" + (fProduct.includes(p) ? " on" : "")} onClick={() => setFProduct(toggleVal(fProduct, p))}>{pname(p)}</button>
            ))}
          </div>
        </div>
        <Segmented label={L.fTemp} values={fType} onChange={setFType}
          options={[{ t: L.all, v: null }, { t: L.hot, v: "hot" }, { t: L.iced, v: "ice" }]} />
        <Segmented label={L.fServe} values={fTake} onChange={setFTake}
          options={[{ t: L.all, v: null }, { t: L.dinein, v: "for here" }, { t: L.takeaway, v: "to go" }]} />
        <button className="reset" disabled={active === 0} onClick={reset}>{L.clear} ({active})</button>
      </section>

      <section className="cd-kpis">
        <Kpi loading={initialLoading} l={L.kSales} v={baht(S.sales)} s={L.salesSub(((S.sales / totalSales) * 100 || 0).toFixed(0))} c={T.gold} />
        <Kpi loading={initialLoading} l={L.kCups} v={S.cups.toLocaleString()} s={L.cupsSub} c={T.text} />
        <Kpi loading={initialLoading} l={L.kCusts} v={S.custCount.toLocaleString()} s={L.custsSub} c={T.text} />
        <Kpi loading={initialLoading} l={L.kAvg} v={baht(avg)} s={L.avgSub} c={T.jade} />
        <Kpi loading={initialLoading} l={L.kBasket} v={baht(basket)} s={L.basketSub} c={T.clay} />
      </section>

      <section className="cd-grid">
        <div className="card span2">
          <div className="card-h"><h3>{L.cSalesByMenu}</h3><span>{L.cHiLo}</span></div>
          {initialLoading ? <Shimmer h={byProduct.length ? Math.max(150, byProduct.length * 44) : 200} />
            : byProduct.length ? (
            <ResponsiveContainer width="100%" height={Math.max(150, byProduct.length * 44)}>
              <BarChart data={byProduct} layout="vertical" margin={{ left: 4, right: 56, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={90} tick={{ fill: T.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: theme === "dark" ? "#ffffff08" : "#00000008" }} content={<Tip T={T} suffix={L.bahtSuffix} />} />
                <Bar dataKey="sales" radius={[0, 6, 6, 0]} barSize={20}>
                  {byProduct.map((d, i) => <Cell key={i} fill={[T.gold, T.clay, T.jade, T.sky, T.plum][i % 5]} />)}
                  <LabelList dataKey="sales" position="right" formatter={(v) => baht(v)} style={{ fill: T.muted, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty L={L} />}
        </div>

        <div className="card">
          <div className="card-h"><h3>{L.cHotIce}</h3><span>{L.cShare}</span></div>
          {initialLoading ? <DonutSkeleton /> : <Donut data={byType} T={T} L={L} />}
        </div>
        <div className="card">
          <div className="card-h"><h3>{L.cServe}</h3><span>{L.cShare}</span></div>
          {initialLoading ? <DonutSkeleton /> : <Donut data={byTake} T={T} L={L} />}
        </div>

        <div className="card span2">
          <div className="card-h"><h3>{L.cPriceDist}</h3><span>{L.cCups}</span></div>
          {initialLoading ? <Shimmer h={196} />
            : S.cups ? (
            <ResponsiveContainer width="100%" height={196}>
              <BarChart data={byPrice} margin={{ left: 8, right: 12, top: 12, bottom: 24 }}>
                <XAxis dataKey="name" tick={{ fill: T.text, fontSize: 12 }} axisLine={{ stroke: T.line }} tickLine={false} label={{ value: L.cPriceX, position: "insideBottom", offset: -12, style: { fill: T.dim, fontSize: 11, textAnchor: "middle" } }} />
                <YAxis tick={{ fill: T.dim, fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: L.cCups, angle: -90, position: "insideLeft", offset: 14, style: { fill: T.dim, fontSize: 11, textAnchor: "middle" } }} />
                <Tooltip cursor={{ fill: theme === "dark" ? "#ffffff08" : "#00000008" }} content={<Tip T={T} suffix={L.cupSuffix} />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={56}>
                  {byPrice.map((d, i) => <Cell key={i} fill={[T.goldDim, T.gold, "#f2c46b"][i]} />)}
                  <LabelList dataKey="value" position="top" style={{ fill: T.muted, fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty L={L} />}
        </div>
      </section>

      {(initialLoading || (rows.length > 0 && desc)) ? (
      <section className="cd-stats-wrap">
        <div className="an-head"><h2>{L.st.head}</h2><p>{L.st.sub}</p></div>
        <div className="cd-grid">

          <div className="card span2">
            <div className="card-h"><h3>{L.st.descTitle}</h3><span>{L.st.descNote}</span></div>
            {initialLoading ? <StatGridSkeleton /> : <>
            <div className="stat-grid">
              <Stat l={L.st.nCust} v={desc.n.toLocaleString()} />
              <Stat l={L.st.mean} v={baht(desc.mean)} accent />
              <Stat l={L.st.median} v={baht(desc.median)} accent />
              <Stat l={L.st.mode} v={baht(desc.mode)} />
              <Stat l={L.st.sd} v={baht(desc.sd)} />
              <Stat l={L.st.cv} v={num1(desc.cv) + "%"} />
              <Stat l={L.st.min} v={baht(desc.min)} />
              <Stat l={L.st.max} v={baht(desc.max)} />
              <Stat l={L.st.range} v={baht(desc.range)} />
              <Stat l={L.st.q1} v={baht(desc.q1)} />
              <Stat l={L.st.q3} v={baht(desc.q3)} />
              <Stat l={L.st.iqr} v={baht(desc.iqr)} />
            </div>
            <div className="stat-shape">
              <span className="stat-shape-l">{L.st.shape}:</span>
              <span className="pill-shape">{desc.skew > 0.5 ? L.st.shapeR : desc.skew < -0.5 ? L.st.shapeL : L.st.shapeN}</span>
              <span className="stat-shape-n">{L.st.skewNote(num1(desc.skew))}</span>
            </div>
            </>}
          </div>

          <div className="card span2">
            <div className="card-h"><h3>{L.st.histTitle}</h3><span>{L.st.histY}</span></div>
            <div className="hist-wrap">
            <div className="hist-inner">
            {initialLoading ? <Shimmer h={215} /> : (
            <ResponsiveContainer width="100%" height={215}>
              <BarChart data={hist} barCategoryGap={0} margin={{ left: 6, right: 12, top: 10, bottom: 26 }}>
                <XAxis dataKey="label" interval={0} tick={{ fill: T.dim, fontSize: 9 }} axisLine={{ stroke: T.line }} tickLine={false} label={{ value: L.st.histX, position: "insideBottom", offset: -14, style: { fill: T.dim, fontSize: 11, textAnchor: "middle" } }} />
                <YAxis tick={{ fill: T.dim, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} label={{ value: L.st.histY, angle: -90, position: "insideLeft", offset: 14, style: { fill: T.dim, fontSize: 11, textAnchor: "middle" } }} />
                <Tooltip cursor={{ fill: theme === "dark" ? "#ffffff08" : "#00000008" }} content={<Tip T={T} suffix={" " + L.st.histY} />} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} fill={T.jade} stroke={T.panel} strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
            )}
            </div>
            </div>
          </div>

          <div className="card span2">
            <div className="card-h"><h3>{L.st.freqTitle}</h3><span>{L.st.modeNote(freq.mode ? pname(freq.mode) : "—")}</span></div>
            {initialLoading ? <TableSkeleton rows={6} /> : (
            <div className="dtable-wrap"><table className="dtable">
              <thead><tr><th>{L.st.cMenu}</th><th className="num">{L.st.cFreq}</th><th className="num">{L.st.cPct}</th><th className="num">{L.st.cProp}</th><th className="num">{L.st.cCum}</th></tr></thead>
              <tbody>
                {freq.rows.map((d) => (
                  <tr key={d.p}><td>{pname(d.p)}</td><td className="num">{d.freq.toLocaleString()}</td><td className="num">{num1(d.pct)}%</td><td className="num">{d.prop.toFixed(3)}</td><td className="num">{num1(d.cumPct)}%</td></tr>
                ))}
                <tr className="dtable-tot"><td>{L.st.total}</td><td className="num">{freq.total.toLocaleString()}</td><td className="num">100%</td><td className="num">1.000</td><td className="num">—</td></tr>
              </tbody>
            </table></div>
            )}
          </div>

          <div className="card span2">
            <div className="card-h"><h3>{L.st.chiTitle}</h3><span>{L.st.pairPT}</span></div>
            {initialLoading ? <TableSkeleton rows={7} /> : (<>
            <div className="dtable-wrap"><table className="dtable">
              <thead><tr><th>{L.st.chiObs}</th>{TYPES.map((t) => <th key={t} className="num">{t === "hot" ? L.hot : L.iced}</th>)}<th className="num">{L.st.total}</th></tr></thead>
              <tbody>
                {PRODUCTS.map((p, i) => chiPT.rowT[i] > 0 ? (
                  <tr key={p}><td>{pname(p)}</td>{TYPES.map((t, j) => <td key={t} className="num">{chiPT.O[i][j].toLocaleString()}</td>)}<td className="num">{chiPT.rowT[i].toLocaleString()}</td></tr>
                ) : null)}
                <tr className="dtable-tot"><td>{L.st.total}</td>{TYPES.map((t, j) => <td key={t} className="num">{chiPT.colT[j].toLocaleString()}</td>)}<td className="num">{chiPT.n.toLocaleString()}</td></tr>
              </tbody>
            </table></div>
            <div className="chi-stats">
              <span>χ² = <b>{num1(chiPT.chi2)}</b></span><span>df = <b>{chiPT.df}</b></span><span><b>{pNote(chiPT.p)}</b></span><span>Cramér's V = <b>{chiPT.cramersV.toFixed(3)}</b></span>
              <span className={"chi-badge" + (chiPT.p < 0.05 ? " yes" : "")}>{chiPT.p < 0.05 ? L.st.sig : L.st.nsig}</span>
              <span className="chi-strength">{chiStrength(chiPT.cramersV)}</span>
            </div>
            <div className="chi-others">
              <div className="chi-others-h">{L.st.otherPairs}</div>
              {[{ n: L.st.pairTS, c: chiTS }, { n: L.st.pairPS, c: chiPS }].map((o, k) => (
                <div className="chi-row" key={k}>
                  <span className="chi-row-n">{o.n}</span>
                  <span>χ² = {num1(o.c.chi2)}</span><span>df = {o.c.df}</span><span>{pNote(o.c.p)}</span><span>V = {o.c.cramersV.toFixed(3)}</span>
                  <span className={"chi-badge" + (o.c.p < 0.05 ? " yes" : "")}>{o.c.p < 0.05 ? L.st.sig : L.st.nsig}</span>
                </div>
              ))}
            </div>
            </>)}
          </div>

          <div className="card span2">
            <div className="card-h"><h3>{L.st.basketTitle}</h3><span>{initialLoading ? "" : L.st.basketNote(mba.nBaskets.toLocaleString())}</span></div>
            {initialLoading ? <TableSkeleton rows={5} /> : (mba.rules.length ? (
              <div className="dtable-wrap"><table className="dtable">
                <thead><tr><th>{L.st.bRule}</th><th className="num">{L.st.bSup}</th><th className="num">{L.st.bConf}</th><th className="num">{L.st.bLift}</th></tr></thead>
                <tbody>
                  {mba.rules.map((r, i) => (
                    <tr key={i}><td>{pname(r.x)} → {pname(r.y)}</td><td className="num">{num1(r.support * 100)}%</td><td className="num">{num1(r.confidence * 100)}%</td><td className={"num" + (r.lift >= 1 ? " pos" : "")}>{r.lift.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table></div>
            ) : <p className="basket-empty">{L.st.basketEmpty}</p>)}
          </div>

        </div>
      </section>
      ) : null}

      <section className="cd-analysis">
        <div className="an-head">
          <h2>{L.anaHead}</h2>
          <p>{L.anaSub}</p>
        </div>
        <div className="an-grid">
          {initialLoading
            ? Array.from({ length: recs.length || 6 }).map((_, i) => <RecSkeleton key={i} />)
            : recs.map((r, i) => (
              <div className="rec" key={i}>
                <div className="rec-top">
                  <span className="rec-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="rec-stat" style={{ color: colorOf(r.color) }}>{r.stat}</span>
                </div>
                <h4>{r.title}</h4>
                <p>{r.body}</p>
              </div>
            ))}
        </div>
      </section>

      <footer className="cd-foot">
        <div className="foot-credit">{L.madeBy} <strong>{L.author}</strong> (695210052-0)</div>
        <div className="foot-links">
            <a href="mailto:songpol.r@kkumail.com" title="songpol.r@kkumail.com" aria-label={L.emailTip}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </a>
            <a href="https://github.com/SongpolR" target="_blank" rel="noopener noreferrer" title="github.com/SongpolR" aria-label={L.ghTip}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"/></svg>
            </a>
        </div>
        <div className="foot-copy">© 2026 {L.author}</div>
      </footer>
    </div>
  );
}

function Kpi({ l, v, s, c, loading }) {
  return (
    <div className="kpi">
      <div className="kpi-l">{l}</div>
      {loading ? (<><Shimmer h={26} w="72%" r={6} style={{ margin: "7px 0 5px" }} /><Shimmer h={9} w="50%" r={4} /></>)
        : (<><div className="kpi-v" style={{ color: c }}>{v}</div><div className="kpi-s">{s}</div></>)}
    </div>
  );
}
function Stat({ l, v, accent }) {
  return (
    <div className="stat-cell">
      <span className="stat-l">{l}</span>
      <span className={"stat-v" + (accent ? " acc" : "")}>{v}</span>
    </div>
  );
}
function StatGridSkeleton() {
  return (
    <>
      <div className="stat-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div className="stat-cell" key={i}><Shimmer h={9} w="62%" r={3} /><Shimmer h={16} w="78%" r={4} /></div>
        ))}
      </div>
      <div className="stat-shape"><Shimmer h={22} w={140} r={999} /></div>
    </>
  );
}
function TableSkeleton({ rows = 5 }) {
  return (
    <div>
      <Shimmer h={13} w="45%" r={4} style={{ marginBottom: 12 }} />
      {Array.from({ length: rows }).map((_, i) => <Shimmer key={i} h={14} w="100%" r={4} style={{ marginBottom: 9 }} />)}
    </div>
  );
}
function Segmented({ label, options, values, onChange }) {
  const toggle = (v) => {
    if (v === null) { onChange([]); return; }            // "ทั้งหมด" = ล้างกลุ่มนี้
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };
  return (
    <div className="seg-wrap">
      <span className="seg-label">{label}</span>
      <div className="seg">
        {options.map((o) => {
          const on = o.v === null ? values.length === 0 : values.includes(o.v);
          return (
            <button key={String(o.v)} className={"seg-btn" + (on ? " on" : "")} onClick={() => toggle(o.v)}>{o.t}</button>
          );
        })}
      </div>
    </div>
  );
}
function Donut({ data, T, L }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty L={L} />;
  return (
    <div className="donut-row">
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip content={<Tip T={T} suffix={L.bahtSuffix} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        {data.map((d, i) => (
          <div className="leg" key={i}>
            <span className="dot" style={{ background: d.fill }} />
            <div><div className="leg-n">{d.name}</div><div className="leg-v">{baht(d.value)} · {((d.value / total) * 100).toFixed(0)}%</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
function DonutSkeleton() {
  return (
    <div className="donut-row">
      <div className="donut-chart" style={{ display: "grid", placeItems: "center", height: 150 }}>
        <div className="skel skel-ring" />
      </div>
      <div className="legend">
        <div className="leg"><Shimmer h={11} w={11} r={3} /><Shimmer h={12} w="70%" r={4} /></div>
        <div className="leg"><Shimmer h={11} w={11} r={3} /><Shimmer h={12} w="55%" r={4} /></div>
      </div>
    </div>
  );
}
function Shimmer({ h, w = "100%", r = 8, style }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r, ...(style || {}) }} />;
}
function RecSkeleton() {
  return (
    <div className="rec">
      <div className="rec-top">
        <Shimmer h={13} w={22} r={4} />
        <Shimmer h={12} w="34%" r={4} />
      </div>
      <Shimmer h={14} w="85%" r={5} style={{ margin: "2px 0 9px" }} />
      <Shimmer h={10} w="100%" r={4} style={{ marginBottom: 6 }} />
      <Shimmer h={10} w="96%" r={4} style={{ marginBottom: 6 }} />
      <Shimmer h={10} w="60%" r={4} />
    </div>
  );
}
function Tip({ active, payload, suffix, T }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (<div style={{ background: T.tipBg, border: "1px solid " + T.line, borderRadius: 8, padding: "6px 10px", color: T.text, fontSize: 12, boxShadow: "0 4px 14px rgba(0,0,0,.25)" }}>
    <div style={{ color: T.muted }}>{p.payload.name}</div>
    <div style={{ fontWeight: 600 }}>{p.value.toLocaleString()}{suffix}</div></div>);
}
function Empty({ L }) { return <div className="empty">{L.empty}</div>; }



ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(CoffeeDashboard));
