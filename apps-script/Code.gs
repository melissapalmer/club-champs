/**
 * Royal Durban GC — Club Champs scoring backend (Google Apps Script).
 *
 * One-time setup per deployment:
 *
 *   1. Create a Google Sheet with three tabs: Players, Scores, Course.
 *      Headers (first row of each):
 *        Players: firstName, lastName, saId, hi, division
 *        Scores:  saId, day, h1, h2, h3, h4, h5, h6, h7, h8, h9,
 *                       h10, h11, h12, h13, h14, h15, h16, h17, h18
 *        Course:  key, value
 *      The Course tab holds the full course config as flattened rows
 *      — see src/sheets/courseAdapter.ts for the keys it expects.
 *
 *   2. Extensions → Apps Script → paste this file, then:
 *      - Set SHEET_ID below to your Sheet's ID
 *      - Set SHARED_SECRET to a string the site will send back to you.
 *
 *   3. Deploy → New deployment → type "Web app" → execute as Me, access
 *      "Anyone". Copy the resulting /exec URL — that's what the site posts to.
 *
 *   4. Publish → Publish to web → entire document → Comma-separated values.
 *      The site reads via the public gviz CSV endpoint; publishing isn't
 *      strictly required for that endpoint but it makes the data world-
 *      readable, which is what we want for spectators.
 *
 * Threat model: the SHARED_SECRET is cosmetic — it stops random visitors
 * from invoking the endpoint, but a determined person could read the
 * site's bundle. The real protection is keeping the Sheet ID / Apps
 * Script URL out of public listings; share them only with admins.
 */

const SHEET_ID = "1yBRZBkMm4QW86uS968aZDGFVEcDx4wgdusKZ6kye-5A";
const SHARED_SECRET = "159357";

const PLAYERS_TAB = "Players";
const SCORES_TAB = "Scores";
const COURSE_TAB = "Course";
const TEE_TIMES_TAB = "TeeTimes";
const MATCHES_TAB = "Matches";

const PLAYERS_HEADERS = [
  "firstName",
  "lastName",
  "saId",
  "hi",
  "division",
  "matchPlay",
];

// Script-properties keys.
//   PLAYER_TOKEN_SALT: rotating salt; per-player tokens are HMAC-derived from
//     (saId | salt | SHARED_SECRET) so they're never stored in the public
//     Players sheet (which leaks via gviz). Rotating the salt invalidates all
//     outstanding magic links — that's what regenerateEntryTokens does.
//   TENT_ENTRY_TOKEN: the single rotating tent volunteer token.
const PLAYER_TOKEN_SALT_PROP = "PLAYER_TOKEN_SALT";
const TENT_TOKEN_PROP = "TENT_ENTRY_TOKEN";
const SCORE_HOLE_COLS = Array.from({ length: 18 }, function (_, i) {
  return "h" + (i + 1);
});
const SCORES_HEADERS = ["saId", "day"].concat(SCORE_HOLE_COLS);
const TEE_TIMES_HEADERS = ["day", "time", "saId", "name"];
const MATCHES_HEADERS = [
  "id",
  "divisionCode",
  "round",
  "slot",
  "playerASaId",
  "playerBSaId",
  "winnerSaId",
  "result",
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;

    // Token-gated player/marker entry: validated inside the handler against
    // the per-player or per-group token. Admin SHARED_SECRET is NOT required —
    // these are the public score-entry channels (QR / magic link / tent URL).
    if (action === "submitScore") {
      return jsonResponse({ ok: true, result: submitScore(body.payload) });
    }
    if (action === "submitScoreGroup") {
      return jsonResponse({ ok: true, result: submitScoreGroup(body.payload) });
    }

    // Everything else requires the admin secret.
    if (body.secret !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: "unauthorised" }, 403);
    }
    let result;
    switch (action) {
      case "upsertScore":
        result = upsertScore(body.payload);
        break;
      case "upsertPlayer":
        result = upsertPlayer(body.payload);
        break;
      case "removePlayer":
        result = removePlayer(body.payload);
        break;
      case "saveCourse":
        result = saveCourse(body.payload);
        break;
      case "saveTeeTimes":
        result = saveTeeTimes(body.payload);
        break;
      case "saveMatches":
        result = saveMatches(body.payload);
        break;
      case "clearMatches":
        result = clearMatches();
        break;
      case "regenerateEntryTokens":
        result = regenerateEntryTokens();
        break;
      case "rotateTentToken":
        result = rotateTentToken();
        break;
      case "getEntryUrls":
        result = getEntryUrls(body.payload);
        break;
      default:
        return jsonResponse(
          { ok: false, error: "unknown_action: " + action },
          400,
        );
    }
    return jsonResponse({ ok: true, result: result });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: String((err && err.message) || err) },
      500,
    );
  }
}

// Browsers send a CORS preflight OPTIONS; Apps Script doesn't expose OPTIONS
// directly, but if the site posts as Content-Type: text/plain there's no
// preflight. We also expose a doGet to confirm the endpoint is alive.
function doGet() {
  return jsonResponse({ ok: true, service: "club-champs-sheets" });
}

function jsonResponse(obj, _status) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Tab not found: " + name);
  return sheet;
}

function ensureHeaders(sheet, expected) {
  const lastCol = Math.max(sheet.getLastColumn(), expected.length);
  const range = sheet.getRange(1, 1, 1, lastCol);
  const row = range.getValues()[0].map(function (v) {
    return String(v).trim();
  });
  // If empty (new sheet), write the headers ourselves so a fresh Sheet
  // doesn't need manual prep.
  if (
    row.every(function (v) {
      return v === "";
    })
  ) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return expected.slice();
  }
  // Otherwise extend with any expected headers that aren't already present
  // (e.g. a new column added in code after the Sheet was first set up).
  // Trailing-empty cells in `row` get trimmed before appending so we don't
  // create gaps in the header.
  let trimmed = row.slice();
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }
  let dirty = false;
  for (let i = 0; i < expected.length; i++) {
    if (trimmed.indexOf(expected[i]) === -1) {
      trimmed.push(expected[i]);
      dirty = true;
    }
  }
  if (dirty) {
    sheet.getRange(1, 1, 1, trimmed.length).setValues([trimmed]);
  }
  return trimmed;
}

// ---- Score upsert -------------------------------------------------------

/**
 * Upsert a player's day-score row.
 *
 * Payload: { saId, day, holes, range? }
 *   - range = 'all' (default), 'front9' or 'back9'.
 *     'front9' writes only h1..h9, preserving h10..h18 if a row exists.
 *     'back9'  writes only h10..h18, preserving h1..h9.
 *   - holes is always 18 entries; with a partial range only the relevant 9
 *     are read.
 */
function upsertScore(payload) {
  if (!payload || !payload.saId || !payload.day || !payload.holes) {
    throw new Error("upsertScore needs { saId, day, holes }");
  }
  const range = payload.range || "all";
  if (range !== "all" && range !== "front9" && range !== "back9") {
    throw new Error("upsertScore range must be 'all', 'front9' or 'back9'");
  }

  const sheet = getSheet(SCORES_TAB);
  const headers = ensureHeaders(sheet, SCORES_HEADERS);
  const lastRow = sheet.getLastRow();
  const idCol = headers.indexOf("saId") + 1;
  const dayCol = headers.indexOf("day") + 1;

  let target = null;
  let existing = null;
  if (lastRow >= 2) {
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = 0; i < data.length; i++) {
      if (
        String(data[i][idCol - 1]).trim() === String(payload.saId) &&
        Number(data[i][dayCol - 1]) === Number(payload.day)
      ) {
        target = i + 2;
        existing = data[i];
        break;
      }
    }
  }

  const row = headers.map(function (h, colIdx) {
    if (h === "saId") return payload.saId;
    if (h === "day") return payload.day;
    const idx = parseInt(h.replace(/^h/, ""), 10);
    if (idx >= 1 && idx <= 18) {
      const inRange =
        range === "all" ||
        (range === "front9" && idx <= 9) ||
        (range === "back9" && idx >= 10);
      if (inRange) {
        const v = payload.holes[idx - 1];
        return v == null || v === "" ? "" : v;
      }
      // Out of range: preserve existing value, otherwise blank.
      return existing ? existing[colIdx] : "";
    }
    return "";
  });

  if (target) {
    sheet.getRange(target, 1, 1, headers.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { saId: payload.saId, day: payload.day, range: range };
}

// ---- Player upsert / remove --------------------------------------------

function upsertPlayer(payload) {
  if (!payload || !payload.saId)
    throw new Error("upsertPlayer needs { saId, ... }");
  const sheet = getSheet(PLAYERS_TAB);
  const headers = ensureHeaders(sheet, PLAYERS_HEADERS);
  const lastRow = sheet.getLastRow();
  const idCol = headers.indexOf("saId");

  let target = null;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(payload.saId)) {
        target = i + 2;
        break;
      }
    }
  }

  const row = headers.map(function (h) {
    const v = payload[h];
    return v == null ? "" : v;
  });

  if (target) {
    sheet.getRange(target, 1, 1, headers.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { saId: payload.saId };
}

function removePlayer(payload) {
  if (!payload || !payload.saId) throw new Error("removePlayer needs { saId }");
  const sheet = getSheet(PLAYERS_TAB);
  const headers = ensureHeaders(sheet, PLAYERS_HEADERS);
  const lastRow = sheet.getLastRow();
  const idCol = headers.indexOf("saId");
  if (lastRow < 2) return { removed: 0 };

  const ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).trim() === String(payload.saId)) {
      sheet.deleteRow(i + 2);
    }
  }
  return { saId: payload.saId };
}

// ---- Course save (full replace) ----------------------------------------

function saveCourse(payload) {
  if (!payload || typeof payload !== "object")
    throw new Error("saveCourse needs an object");
  const sheet = getSheet(COURSE_TAB);
  // Clear and rewrite. The Course tab is small; full replace is simplest.
  sheet.clear();
  const rows = [["key", "value"]];
  Object.keys(payload).forEach(function (k) {
    rows.push([k, payload[k]]);
  });
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  return { rows: rows.length - 1 };
}

// ---- Tee Times save (day-scoped replace) -------------------------------

/**
 * Overwrite the rows for one day in the TeeTimes tab. The other day's rows
 * are preserved so generating Day 1 doesn't nuke Day 2 (and vice versa).
 *
 * Payload: { day: 1|2, rows: [{ time, saId, name }, ...] }
 *
 * Creates the tab + header row on first call.
 */
function saveTeeTimes(payload) {
  if (!payload || (payload.day !== 1 && payload.day !== 2)) {
    throw new Error("saveTeeTimes needs { day: 1|2, rows: [...] }");
  }
  if (!Array.isArray(payload.rows)) {
    throw new Error("saveTeeTimes needs an array of rows");
  }
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(TEE_TIMES_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(TEE_TIMES_TAB);
    sheet
      .getRange(1, 1, 1, TEE_TIMES_HEADERS.length)
      .setValues([TEE_TIMES_HEADERS]);
  }
  ensureHeaders(sheet, TEE_TIMES_HEADERS);

  const lastRow = sheet.getLastRow();
  const dayCol = TEE_TIMES_HEADERS.indexOf("day") + 1;

  // Walk bottom-up deleting rows where `day` matches the payload day. Bottom-up
  // so deleteRow's row-index shift doesn't affect later iterations.
  if (lastRow >= 2) {
    const days = sheet.getRange(2, dayCol, lastRow - 1, 1).getValues();
    for (let i = days.length - 1; i >= 0; i--) {
      if (Number(days[i][0]) === Number(payload.day)) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  // Append the new rows for this day.
  if (payload.rows.length > 0) {
    const newRows = payload.rows.map(function (r) {
      return [
        payload.day,
        String(r.time || ""),
        String(r.saId || ""),
        String(r.name || ""),
      ];
    });
    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        newRows.length,
        TEE_TIMES_HEADERS.length,
      )
      .setValues(newRows);
  }
  return { day: payload.day, rows: payload.rows.length };
}

// ---- Match Play save (full bracket replace) ----------------------------

/**
 * Bulk replace the Matches tab. Mirrors saveCourse's clear-and-rewrite —
 * fine for ≤32 rows. Used both for Generate (fresh bracket) and per-result
 * save (writing the propagated array). Atomicity matters more than incremental
 * cost at this scale.
 *
 * Payload: { rows: [{ id, round, slot, playerASaId, playerBSaId, winnerSaId, result }, ...] }
 *
 * Creates the tab + header row on first call.
 */
function saveMatches(payload) {
  if (!payload || !Array.isArray(payload.rows)) {
    throw new Error("saveMatches needs { rows: [...] }");
  }
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(MATCHES_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(MATCHES_TAB);
  }
  // Clear and rewrite: header + all rows.
  sheet.clear();
  const out = [MATCHES_HEADERS.slice()];
  payload.rows.forEach(function (r) {
    out.push([
      String(r.id || ""),
      String(r.divisionCode || ""),
      Number(r.round) || 0,
      Number(r.slot) || 0,
      String(r.playerASaId || ""),
      String(r.playerBSaId || ""),
      String(r.winnerSaId || ""),
      String(r.result || ""),
    ]);
  });
  sheet.getRange(1, 1, out.length, MATCHES_HEADERS.length).setValues(out);
  return { rows: payload.rows.length };
}

/** Wipe the Matches tab — header preserved, all data rows removed. */
function clearMatches() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(MATCHES_TAB);
  if (!sheet) return { cleared: 0 };
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, MATCHES_HEADERS.length).clearContent();
  }
  return { cleared: Math.max(0, lastRow - 1) };
}

// ---- Score-entry tokens (player magic links / group QR / tent URL) ------

/**
 * Normalise a TeeTimes time cell to "HH:mm". `getValues()` returns time-
 * formatted cells as Date objects (epoch 1899-12-30); naïve `String()` then
 * yields "Sat Dec 30 1899 08:07:00 GMT+0130 (...)" which breaks both URL
 * building and group-token verification (client always sees the gviz CSV
 * string, e.g. "08:07"). Forcing HH:mm in the script's timezone keeps both
 * sides aligned.
 */
function formatTime_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(
      v,
      Session.getScriptTimeZone(),
      "HH:mm",
    );
  }
  return String(v || "").trim();
}

/** Random URL-safe token (used for the tent token + the rotating salt). */
function makeRandomToken_() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // base32-ish, no I/O/0/1
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/** First 12 hex chars of SHA-256(raw). Stable, opaque, URL-safe. */
function shortDigest_(raw) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
  );
  let hex = "";
  for (let i = 0; i < digest.length; i++) {
    let b = digest[i];
    if (b < 0) b += 256;
    const h = b.toString(16);
    hex += h.length === 1 ? "0" + h : h;
  }
  return hex.substring(0, 12);
}

/**
 * 6-character readable token derived from SHA-256(raw). Alphabet excludes
 * the easily-confused 0/O/1/I — important because the QR sheet shows the
 * URL as a fallback for typing when QR scanning fails.
 *
 * 32^6 ≈ 10^9 combinations: fine for tournament-scale gating, especially
 * with Apps Script's per-user rate limits.
 */
function readableToken_(raw) {
  // 32 chars, no I/O/0/1.
  const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
  );
  let out = "";
  for (let i = 0; i < 6; i++) {
    let b = digest[i];
    if (b < 0) b += 256;
    out += ALPHABET.charAt(b & 31);
  }
  return out;
}

/**
 * Deterministic group token: SHA-256 of (day, time, SHARED_SECRET). Same group
 * → same token, every time. Used to print QR codes and verify submissions
 * later without storing per-group rows.
 *
 * Token is the readable 6-char form so the printed URL on the QR sheet can
 * be hand-typed if a marker's phone can't scan.
 */
function groupTokenFor_(day, time) {
  return readableToken_(String(day) + "-" + String(time) + "|" + SHARED_SECRET);
}

/**
 * Per-player token: SHA-256 of (saId, salt, SHARED_SECRET). Salt is stored in
 * script properties (NOT in the public Players sheet) so the tokens never
 * leak via gviz. Rotating the salt invalidates every outstanding magic link.
 *
 * Returns the readable 6-char form, matching the group token, so the printed
 * magic-link URL on the QR sheet (or WhatsApp message) can be hand-typed.
 */
function entryTokenFor_(saId) {
  return readableToken_(
    String(saId) + "|" + getOrCreatePlayerSalt_() + "|" + SHARED_SECRET,
  );
}

function getOrCreatePlayerSalt_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty(PLAYER_TOKEN_SALT_PROP);
  if (!s) {
    s = makeRandomToken_();
    props.setProperty(PLAYER_TOKEN_SALT_PROP, s);
  }
  return s;
}

/**
 * Read (or lazily create) the rotating tent token from script properties.
 * One token covers the whole field; tent volunteers are trusted, so a single
 * shared URL is acceptable. Rotated by the rotateTentToken admin action.
 */
function getOrCreateTentToken_() {
  const props = PropertiesService.getScriptProperties();
  let t = props.getProperty(TENT_TOKEN_PROP);
  if (!t) {
    t = makeRandomToken_();
    props.setProperty(TENT_TOKEN_PROP, t);
  }
  return t;
}

/**
 * Token-gated single-player score submit (channels #2 and #3).
 *
 * Payload: { saId, day, holes, range?, t }
 *   t must equal either the player's stored entryToken (per-player magic
 *   link) or the rotating tent token (tent volunteer URL).
 */
function submitScore(payload) {
  if (!payload || !payload.saId || !payload.day || !payload.holes || !payload.t) {
    throw new Error("submitScore needs { saId, day, holes, t }");
  }
  const t = String(payload.t);
  const tentToken = getOrCreateTentToken_();
  const playerToken = entryTokenFor_(payload.saId);
  if (t !== tentToken && t !== playerToken) {
    throw new Error("unauthorised");
  }
  return upsertScore({
    saId: payload.saId,
    day: payload.day,
    holes: payload.holes,
    range: payload.range,
  });
}

/**
 * Token-gated batched group submit for the marker-wizard (channel #1).
 *
 * Payload: {
 *   group: 'day-time' (e.g. '1-07:30'),
 *   t: groupToken,
 *   range: 'front9'|'back9'|'all',
 *   scores: [{ saId, day, holes }, ...]
 * }
 */
function submitScoreGroup(payload) {
  if (
    !payload ||
    !payload.group ||
    !payload.t ||
    !Array.isArray(payload.scores)
  ) {
    throw new Error("submitScoreGroup needs { group, t, scores }");
  }
  const parts = String(payload.group).split("-");
  if (parts.length < 2) throw new Error("group must be 'day-time'");
  const day = Number(parts.shift());
  const time = parts.join("-");
  const expected = groupTokenFor_(day, time);
  if (String(payload.t) !== expected) throw new Error("unauthorised");

  const results = [];
  for (let i = 0; i < payload.scores.length; i++) {
    const s = payload.scores[i];
    if (!s || !s.saId || !s.day || !s.holes) continue;
    results.push(
      upsertScore({
        saId: s.saId,
        day: s.day,
        holes: s.holes,
        range: payload.range,
      }),
    );
  }
  return { saved: results.length };
}

// ---- Admin: token generation / URL listing ------------------------------

/**
 * Rotate the per-player token salt. Every player's magic-link token changes;
 * any URL printed before this call stops working. Doesn't touch the Players
 * sheet (tokens are HMAC-derived from salt + saId, not stored).
 */
function regenerateEntryTokens() {
  const props = PropertiesService.getScriptProperties();
  const fresh = makeRandomToken_();
  props.setProperty(PLAYER_TOKEN_SALT_PROP, fresh);
  return { rotated: true };
}

/** Generate a fresh tent token; old tent URLs stop working. */
function rotateTentToken() {
  const props = PropertiesService.getScriptProperties();
  const fresh = makeRandomToken_();
  props.setProperty(TENT_TOKEN_PROP, fresh);
  return { tentToken: fresh };
}

/**
 * Return everything the admin Config sub-tab needs to print QR sheets and
 * copy magic links: per-player URLs, per-group URLs (with computed tokens),
 * and the current tent token.
 *
 * Payload: { baseUrl: 'https://example.com/club-champs/' }
 *   baseUrl is the deployed site root *with* trailing slash; the function
 *   appends `#/enter…` etc. (HashRouter).
 */
function getEntryUrls(payload) {
  const baseUrl = String((payload && payload.baseUrl) || "");
  if (!baseUrl) throw new Error("getEntryUrls needs { baseUrl }");

  // Players: tokens are HMAC-derived from saId + salt + SHARED_SECRET, so we
  // recompute on demand rather than reading them from the sheet.
  const pSheet = getSheet(PLAYERS_TAB);
  const pHeaders = ensureHeaders(pSheet, PLAYERS_HEADERS);
  const pLast = pSheet.getLastRow();
  const players = [];
  if (pLast >= 2) {
    const fnCol = pHeaders.indexOf("firstName");
    const lnCol = pHeaders.indexOf("lastName");
    const idCol = pHeaders.indexOf("saId");
    const rows = pSheet.getRange(2, 1, pLast - 1, pHeaders.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      const id = String(rows[i][idCol]).trim();
      if (!id) continue;
      const name = (
        String(rows[i][fnCol] || "").trim() +
        " " +
        String(rows[i][lnCol] || "").trim()
      ).trim();
      // Compact URL form: `#/p/{saId}-{TOKEN}` — single path segment,
      // no query string. Mirrors the group URL pattern (`#/g/D1-0800-XKB97R`)
      // so the printed magic-link URL can be hand-typed if needed.
      players.push({
        saId: id,
        name: name,
        url: baseUrl + "#/p/" + id + "-" + entryTokenFor_(id),
      });
    }
  }

  // Groups (one entry per unique day+time in TeeTimes).
  const ttSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(
    TEE_TIMES_TAB,
  );
  const groups = [];
  if (ttSheet) {
    const ttLast = ttSheet.getLastRow();
    if (ttLast >= 2) {
      const ttRows = ttSheet
        .getRange(2, 1, ttLast - 1, TEE_TIMES_HEADERS.length)
        .getValues();
      const byKey = {};
      for (let i = 0; i < ttRows.length; i++) {
        const day = Number(ttRows[i][0]);
        const time = formatTime_(ttRows[i][1]);
        const name = String(ttRows[i][3] || "").trim();
        if (!day || !time) continue;
        const key = day + "-" + time;
        if (!byKey[key]) {
          // Compact URL form: `#/g/D{day}-{HHMM}-{TOKEN}` — single path
          // segment, no query string, no encoded colons. Reads as
          // "Day 1, 08:00, code XKB97R" so a marker with a malfunctioning
          // QR scanner can hand-type it from the printed sheet.
          const timeNoColon = time.replace(":", "");
          byKey[key] = {
            day: day,
            time: time,
            names: [],
            url:
              baseUrl +
              "#/g/D" +
              day +
              "-" +
              timeNoColon +
              "-" +
              groupTokenFor_(day, time),
          };
        }
        byKey[key].names.push(name);
      }
      // Stable order: day, then time.
      const keys = Object.keys(byKey).sort();
      for (let i = 0; i < keys.length; i++) groups.push(byKey[keys[i]]);
    }
  }

  // Tent URL.
  const tentToken = getOrCreateTentToken_();
  const tentUrl = baseUrl + "#/enter-all?t=" + tentToken;

  return { players: players, groups: groups, tentUrl: tentUrl };
}
