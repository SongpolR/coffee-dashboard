/**
 * AI Recommendation — Firebase Cloud Function (secure proxy to Claude).
 *
 * Why this exists: the dashboard is a static site on GitHub Pages, so an
 * Anthropic API key can never live in the browser. This function holds the key
 * (as a Cloud Function secret), calls Claude Haiku with the *already-computed*
 * statistics, and writes the result into Realtime DB at /aiRecs/<hash> so the
 * client can read it (the client never writes — same security model as /signal).
 *
 * Deploy + set the key: see ../AI_RECOMMENDATION_SETUP.md
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const AnthropicPkg = require("@anthropic-ai/sdk");

// The SDK class is exported differently across versions — be defensive.
const Anthropic = AnthropicPkg.Anthropic || AnthropicPkg.default || AnthropicPkg;

// Regional DB URL (public identifier — same one in config.js).
admin.initializeApp({
  databaseURL:
    "https://coffee-dashboard-3ff7f-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// Match the Realtime DB region; cap instances so a runaway can't rack up cost.
setGlobalOptions({ region: "asia-southeast1", maxInstances: 5 });

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are a retail analytics advisor for a coffee shop's decision-support dashboard.
You are given statistics that have ALREADY been computed from the point-of-sale data.
Rules:
- Interpret the numbers you are given. NEVER invent, recompute, or assume figures that are not provided.
- Every recommendation must reference a specific figure from the input that motivates it.
- Be concrete and actionable — things the owner can do this week (menu, pricing, staffing, promotions).
- Keep each recommendation to 1-2 sentences.
- Write ALL text in {language}.`;

// JSON schema for structured outputs — forces valid, fence-free JSON from the model.
const REC_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["title", "detail", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "recommendations"],
  additionalProperties: false,
};

function safeParseJson(text) {
  let t = String(text || "").trim();
  // Strip ```json … ``` (or plain ``` … ```) code fences if the model added them.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch (_) {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(t.slice(start, end + 1)); } catch (__) { /* fall through */ }
    }
    return null;
  }
}

// ── Rate limiting ──────────────────────────────────────────────────────────
// One AI generation per visitor every 3 minutes. The last-generation timestamp
// per IP lives in Realtime DB (default-deny path; only this admin function
// touches it). IPs are hashed — never stored raw.
const AI_COOLDOWN_MS = 180000; // 3 minutes

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

function clientIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || req.ip || "unknown";
}

async function checkRateLimit(ipHash) {
  const now = Date.now();
  let retryAfterSec = 0;

  // One generation per AI_COOLDOWN_MS per visitor (IP). Atomic check-and-set:
  // if still within the cooldown window, abort the transaction (no write).
  const res = await admin
    .database()
    .ref("aiRateLimit/ip/" + ipHash)
    .transaction((cur) => {
      cur = cur || {};
      const last = cur.last || 0;
      if (now - last < AI_COOLDOWN_MS) {
        retryAfterSec = Math.ceil((AI_COOLDOWN_MS - (now - last)) / 1000);
        return; // abort — within cooldown
      }
      cur.last = now;
      return cur;
    });

  if (!res.committed || retryAfterSec > 0) {
    return { ok: false, message: "Please wait before generating again.", retryAfterSec: retryAfterSec || Math.ceil(AI_COOLDOWN_MS / 1000) };
  }
  return { ok: true };
}

exports.aiRecommendation = onRequest(
  { secrets: [ANTHROPIC_API_KEY], cors: true, timeoutSeconds: 60, memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST." });
      return;
    }

    const body = req.body || {};
    const hash = String(body.hash || "");
    const lang = body.lang === "th" ? "th" : "en";
    const stats = body.stats;

    if (!hash || !stats || typeof stats !== "object") {
      res.status(400).json({ error: "Missing 'hash' or 'stats'." });
      return;
    }

    // Rate limit BEFORE spending an API call. Fail-open if the limiter infra
    // itself errors, so a DB hiccup never blocks legitimate users.
    let limit = { ok: true };
    try {
      limit = await checkRateLimit(fnv1a(clientIp(req)));
    } catch (e) {
      console.warn("rate-limit check failed, allowing:", e && e.message);
    }
    if (!limit.ok) {
      res.set("Retry-After", String(limit.retryAfterSec || 60));
      res.status(429).json({ error: limit.message, retryAfterSec: limit.retryAfterSec });
      return;
    }

    const language = lang === "th" ? "Thai" : "English";

    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

      const userMessage =
        "Statistics (already computed — interpret only, do not recompute):\n\n" +
        JSON.stringify(stats, null, 2) +
        "\n\nReturn 3 to 4 recommendations, ordered most to least impactful, each with a short " +
        "title, a one-sentence detail that cites a specific figure, and a priority of high, " +
        "medium, or low. Write all text in " + language + ".";

      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048, // Thai output is token-heavy — headroom so the JSON isn't truncated
        system: SYSTEM_PROMPT.replace("{language}", language),
        messages: [{ role: "user", content: userMessage }],
        // Structured output: forces schema-valid JSON (no code fences, no prose).
        output_config: { format: { type: "json_schema", schema: REC_SCHEMA } },
      });

      const text = (message.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      const parsed = safeParseJson(text);
      const recsArr = parsed && Array.isArray(parsed.recommendations) ? parsed.recommendations : null;

      // If the output is unparseable or empty (e.g. truncated at max_tokens), do NOT
      // cache garbage — return an error so the client shows a retry instead.
      if (!recsArr || recsArr.length === 0) {
        console.error("AI output unparseable/empty; stop_reason=", message.stop_reason, "len=", text.length);
        res.status(502).json({ error: "The model returned an unreadable response. Please try again." });
        return;
      }

      const result = {
        summary: String(parsed.summary || "").slice(0, 600),
        recs: recsArr.slice(0, 6).map((r) => ({
          title: String(r.title || "").slice(0, 120),
          detail: String(r.detail || "").slice(0, 600),
          priority: ["high", "medium", "low"].includes(r.priority) ? r.priority : "medium",
        })),
        lang,
        model: MODEL,
        generatedAt: Date.now(),
      };

      // Cache for the client to read (data-hash keyed → only regenerates when data changes).
      await admin.database().ref("aiRecs/" + hash).set(result);

      res.json(result);
    } catch (err) {
      console.error("aiRecommendation failed:", err);
      res.status(500).json({ error: err.message || "Generation failed." });
    }
  }
);
