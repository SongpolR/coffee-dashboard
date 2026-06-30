/**
 * App config (committed) — these are PUBLIC identifiers, not secrets:
 *   apiUrl   = Apps Script Web App /exec (deployed "Anyone")
 *   sheetUrl = public Google Sheet link (header "Open Sheet" button)
 *   firebase = Firebase web config (identifier, not a credential; protection is via DB Rules)
 * The only real secret (Firebase DB write secret) stays in Apps Script ▸ Script properties — never here.
 */
window.APP_CONFIG = {
  "apiUrl": "https://script.google.com/macros/s/AKfycbyiD8tt9KIDgCdXAC4i8qLrjA_mk1_4lrBtYaF4ihGG7EXY1nIwJIZQ1y27rZB6-wWc/exec",
  // AI Recommendation Cloud Function HTTPS URL (set after `firebase deploy --only functions`).
  // Leave "" to hide the AI card. See AI_RECOMMENDATION_SETUP.md.
  "aiFnUrl": "https://airecommendation-b2ws7ys34q-as.a.run.app",
  "sheetUrl": "https://docs.google.com/spreadsheets/d/1vTRRy_yjZgVq1dW9R2ya2pK4moTqzb0xCE4bYZRyp04/edit?usp=sharing",
  "firebase": {
    "databaseURL": "https://coffee-dashboard-3ff7f-default-rtdb.asia-southeast1.firebasedatabase.app/",
    "apiKey": "AIzaSyA9kEjPZC1C5OUcwILQcAPysRVJCI-Fk1w",
    "authDomain": "coffee-dashboard-3ff7f.firebaseapp.com",
    "projectId": "coffee-dashboard-3ff7f",
    "storageBucket": "coffee-dashboard-3ff7f.firebasestorage.app",
    "messagingSenderId": "457570252119",
    "appId": "1:457570252119:web:605dfb358ca2eade61fa12",
    "measurementId": "G-WWWE84NSZK"
  }
};
