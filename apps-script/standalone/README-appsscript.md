# Coffee Dashboard — เวอร์ชัน "ทุกอย่างอยู่ใน Google Apps Script"

บิลด์คู่ขนานของแดชบอร์ดที่ **ไม่พึ่ง GitHub Pages, Firebase หรือ Cloud Function เลย** —
ทั้งหน้าเว็บ, API ข้อมูล และ AI Recommendation รันอยู่ใน Apps Script โปรเจกต์เดียว
เวอร์ชัน GitHub Pages เดิมยังอยู่ครบและใช้งานได้ตามปกติ (โฟลเดอร์นี้ไม่แตะไฟล์เดิม)

## ทุกฟีเจอร์ยังทำงานเหมือนเดิมไหม?

| ฟีเจอร์ | GitHub Pages เดิม | เวอร์ชัน Apps Script นี้ | เหมือนเดิม? |
|---|---|---|---|
| กราฟ, สถิติ DSS, histogram, chi-square, ธีม, TH/EN, ตัวกรอง | JS ในเบราว์เซอร์ | โค้ด JS ชุดเดียวกันเป๊ะ | ✅ เหมือนทุกพิกเซล |
| ข้อมูลสดจากชีต | Apps Script `/exec` (fetch) | `google.script.run.getOrders()` | ✅ ผลลัพธ์เดียวกัน |
| AI Recommendation (Claude) | Firebase Cloud Function | `google.script.run.getAiRecommendation()` (คีย์อยู่ใน Script properties) | ✅ พฤติกรรมเดียวกัน |
| อัปเดตอัตโนมัติเมื่อชีตเปลี่ยน | Firebase push (ทันที) | **polling ทุก 15 วิ** (fallback ที่มีอยู่แล้ว) | ⚠️ ใกล้เคียง ไม่ใช่ push ทันที |

> จุดเดียวที่ต่างจริง ๆ คือ realtime: Apps Script ผลักข้อมูลเข้าเบราว์เซอร์ไม่ได้
> จึงถอยไปใช้การ poll ทุก 15 วิ (โค้ดเดิมมี fallback นี้อยู่แล้ว) — สำหรับแดชบอร์ดยอดขาย
> ผู้ชมแทบไม่รู้สึกถึงความต่าง

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ในรีโป | ชื่อ/ชนิดในตัวแก้ไข Apps Script | ที่มา |
|---|---|---|
| `Code.gs` | `Code` · **Script** (.gs) | เขียนใหม่: doGet + getOrders + getAiRecommendation |
| `Index.html` | `Index` · **HTML** | เทมเพลตหน้าเว็บ (ฝัง Styles/Config/App) |
| `Styles.html` | `Styles` · **HTML** | = `styles.css` ห่อด้วย `<style>` |
| `Config.html` | `Config` · **HTML** | ตั้ง `window.APP_CONFIG` (ไม่มี apiUrl/firebase) |
| `App.html` | `App` · **HTML** | = `app.jsx` เปลี่ยนแค่ชั้นรับส่งข้อมูลเป็น `google.script.run` |
| `appsscript.json` | manifest (เปิดดูได้ที่ Project Settings ▸ Show "appsscript.json") | ตั้งค่า Web app + V8 |

> ในตัวแก้ไข Apps Script ไฟล์ HTML ทุกไฟล์ **ตั้งชื่อโดยไม่ต้องมีนามสกุล** (`Index`, `Styles`,
> `Config`, `App`) แล้วเลือกชนิดเป็น HTML — ตัวโปรแกรมเติม `.html` ให้เอง

## ติดตั้ง (ครั้งเดียว)

### วิธี A — วางด้วยมือ (ง่ายสุด ไม่ต้องลงเครื่องมือ)

1. เปิด **Google Sheet ของร้าน** → เมนู **Extensions ▸ Apps Script**
   (ทำแบบ *bound* กับชีตแบบนี้ `getActiveSpreadsheet()` จะอ่านชีตได้ทันที ไม่ต้องใส่ `SHEET_ID`)
2. สร้างไฟล์ให้ครบตามตารางข้างบน แล้ววางเนื้อหาจากโฟลเดอร์นี้ลงไปให้ตรงไฟล์
   - ไฟล์ `Code.gs` → ไฟล์สคริปต์ `Code`
   - อีก 4 ไฟล์ `.html` → กด **＋ ▸ HTML** แล้วตั้งชื่อ `Index`, `Styles`, `Config`, `App`
3. ตั้งคีย์ AI: **Project Settings ⚙ ▸ Script properties ▸ Add script property**
   - ชื่อ (key): `ANTHROPIC_API_KEY`
   - ค่า (value): คีย์ Anthropic ของคุณ (`sk-ant-…`)
   - > นี่คือ *ความลับเดียว* ของทั้งระบบ — อยู่ฝั่งเซิร์ฟเวอร์ ไม่มีทางหลุดไปเบราว์เซอร์
   - ถ้าไม่ตั้งคีย์: การ์ด AI จะยังโชว์ แต่กดสร้างแล้วขึ้น "ยังไม่ได้ตั้งค่า" (ฟีเจอร์อื่นทำงานปกติ)
4. (ถ้าจำเป็น) แก้ค่าใน `Config` ▸ `sheetUrl` ให้ตรงชีตของคุณ และ `Code.gs` ▸ `GID`
   ให้ตรงแท็บที่ใช้ (ค่าเริ่มต้นตรงกับของเดิมอยู่แล้ว)
5. **Deploy ▸ New deployment ▸** เลือกชนิด **Web app**
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
6. กด **Deploy** → อนุญาตสิทธิ์ (ครั้งแรกจะขอสิทธิ์อ่านชีต + เรียก URL ภายนอกสำหรับ AI)
7. คัดลอก **Web app URL** (ลงท้าย `/exec`) — นี่คือลิงก์เดียวของแดชบอร์ด เปิดได้เลย

> แก้โค้ดภายหลัง: ต้อง **Deploy ▸ Manage deployments ▸ Edit ✏️ ▸ Version = New version ▸ Deploy**
> มิฉะนั้น `/exec` จะยังรันโค้ดเวอร์ชันเก่า

### วิธี B — ผ่าน clasp (สำหรับ push จากรีโปนี้)

```bash
npm i -g @google/clasp
clasp login
cd apps-script/standalone
clasp create --type sheets --title "Coffee Dashboard (Apps Script)"   # หรือ clasp clone <scriptId>
clasp push        # อัปโหลด Code.gs + *.html + appsscript.json
```
จากนั้นตั้ง `ANTHROPIC_API_KEY` ใน Script properties และ Deploy เป็น Web app ตามขั้น 3–7 ข้างบน
(หากใช้เป็นสคริปต์ *standalone* ไม่ผูกกับชีต ให้ใส่ `SHEET_ID` ใน `Code.gs`)

## ข้อจำกัดที่ควรรู้ (เล็กน้อย)

- **realtime = polling 15 วิ** (ไม่ใช่ push ทันที) — เหตุผลตามหัวข้อด้านบน
- **URL เป็นลิงก์ `script.google.com/macros/s/…/exec`** — ยังเป็นลิงก์เดียว เปิดง่าย แค่ไม่สวยเท่าโดเมนเอง
  และหน้าเว็บรันในกรอบ iframe ที่ `googleusercontent.com` (localStorage ธีม/ภาษา + สคริปต์ CDN
  React/Recharts/Babel ทำงานปกติ)
- **แคชคำแนะนำ AI อยู่ 6 ชม.** (เพดาน `CacheService`) แล้วสร้างใหม่เมื่อเรียก — ของเดิมบน Firebase
  เก็บถาวรกว่า; สำหรับงานนี้เพียงพอ และช่วยประหยัดค่า API เมื่อข้อมูลไม่เปลี่ยน
- **ชื่อแท็บเบราว์เซอร์** ถูกตั้งครั้งเดียวจากฝั่งเซิร์ฟเวอร์ (แอปในกรอบ iframe เปลี่ยน title ของแท็บนอกไม่ได้)
- **โควตา** UrlFetchApp ~20,000 ครั้ง/วัน และรันได้สูงสุด 6 นาที/ครั้ง — เหลือเฟือสำหรับแดชบอร์ดนี้
