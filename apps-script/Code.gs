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

const SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
const SHARED_SECRET = 'CHANGE_ME';

const PLAYERS_TAB = 'Players';
const SCORES_TAB = 'Scores';
const COURSE_TAB = 'Course';
const TEE_TIMES_TAB = 'TeeTimes';
const MATCHES_TAB = 'Matches';

const PLAYERS_HEADERS = ['firstName', 'lastName', 'saId', 'hi', 'division', 'matchPlay'];
const SCORE_HOLE_COLS = Array.from({ length: 18 }, function (_, i) {
  return 'h' + (i + 1);
});
const SCORES_HEADERS = ['saId', 'day'].concat(SCORE_HOLE_COLS);
const TEE_TIMES_HEADERS = ['day', 'time', 'saId', 'name'];
const MATCHES_HEADERS = ['id', 'round', 'slot', 'playerASaId', 'playerBSaId', 'winnerSaId', 'result'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.secret !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: 'unauthorised' }, 403);
    }
    const action = body.action;
    let result;
    switch (action) {
      case 'upsertScore':
        result = upsertScore(body.payload);
        break;
      case 'upsertPlayer':
        result = upsertPlayer(body.payload);
        break;
      case 'removePlayer':
        result = removePlayer(body.payload);
        break;
      case 'saveCourse':
        result = saveCourse(body.payload);
        break;
      case 'saveTeeTimes':
        result = saveTeeTimes(body.payload);
        break;
      case 'saveMatches':
        result = saveMatches(body.payload);
        break;
      case 'clearMatches':
        result = clearMatches();
        break;
      default:
        return jsonResponse({ ok: false, error: 'unknown_action: ' + action }, 400);
    }
    return jsonResponse({ ok: true, result: result });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) }, 500);
  }
}

// Browsers send a CORS preflight OPTIONS; Apps Script doesn't expose OPTIONS
// directly, but if the site posts as Content-Type: text/plain there's no
// preflight. We also expose a doGet to confirm the endpoint is alive.
function doGet() {
  return jsonResponse({ ok: true, service: 'club-champs-sheets' });
}

function jsonResponse(obj, _status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Tab not found: ' + name);
  return sheet;
}

function ensureHeaders(sheet, expected) {
  const lastCol = Math.max(sheet.getLastColumn(), expected.length);
  const range = sheet.getRange(1, 1, 1, lastCol);
  const row = range.getValues()[0].map(function (v) { return String(v).trim(); });
  // If empty (new sheet), write the headers ourselves so a fresh Sheet
  // doesn't need manual prep.
  if (row.every(function (v) { return v === ''; })) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return expected.slice();
  }
  return row;
}

// ---- Score upsert -------------------------------------------------------

function upsertScore(payload) {
  if (!payload || !payload.saId || !payload.day || !payload.holes) {
    throw new Error('upsertScore needs { saId, day, holes }');
  }
  const sheet = getSheet(SCORES_TAB);
  const headers = ensureHeaders(sheet, SCORES_HEADERS);
  const lastRow = sheet.getLastRow();
  const idCol = headers.indexOf('saId') + 1;
  const dayCol = headers.indexOf('day') + 1;

  let target = null;
  if (lastRow >= 2) {
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = 0; i < data.length; i++) {
      if (
        String(data[i][idCol - 1]).trim() === String(payload.saId) &&
        Number(data[i][dayCol - 1]) === Number(payload.day)
      ) {
        target = i + 2; // sheet row index
        break;
      }
    }
  }

  const row = headers.map(function (h) {
    if (h === 'saId') return payload.saId;
    if (h === 'day') return payload.day;
    const idx = parseInt(h.replace(/^h/, ''), 10);
    if (idx >= 1 && idx <= 18) {
      const v = payload.holes[idx - 1];
      return v == null || v === '' ? '' : v;
    }
    return '';
  });

  if (target) {
    sheet.getRange(target, 1, 1, headers.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { saId: payload.saId, day: payload.day };
}

// ---- Player upsert / remove --------------------------------------------

function upsertPlayer(payload) {
  if (!payload || !payload.saId) throw new Error('upsertPlayer needs { saId, ... }');
  const sheet = getSheet(PLAYERS_TAB);
  const headers = ensureHeaders(sheet, PLAYERS_HEADERS);
  const lastRow = sheet.getLastRow();
  const idCol = headers.indexOf('saId');

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
    return v == null ? '' : v;
  });

  if (target) {
    sheet.getRange(target, 1, 1, headers.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { saId: payload.saId };
}

function removePlayer(payload) {
  if (!payload || !payload.saId) throw new Error('removePlayer needs { saId }');
  const sheet = getSheet(PLAYERS_TAB);
  const headers = ensureHeaders(sheet, PLAYERS_HEADERS);
  const lastRow = sheet.getLastRow();
  const idCol = headers.indexOf('saId');
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
  if (!payload || typeof payload !== 'object') throw new Error('saveCourse needs an object');
  const sheet = getSheet(COURSE_TAB);
  // Clear and rewrite. The Course tab is small; full replace is simplest.
  sheet.clear();
  const rows = [['key', 'value']];
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
    throw new Error('saveTeeTimes needs { day: 1|2, rows: [...] }');
  }
  if (!Array.isArray(payload.rows)) {
    throw new Error('saveTeeTimes needs an array of rows');
  }
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(TEE_TIMES_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(TEE_TIMES_TAB);
    sheet.getRange(1, 1, 1, TEE_TIMES_HEADERS.length).setValues([TEE_TIMES_HEADERS]);
  }
  ensureHeaders(sheet, TEE_TIMES_HEADERS);

  const lastRow = sheet.getLastRow();
  const dayCol = TEE_TIMES_HEADERS.indexOf('day') + 1;

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
        String(r.time || ''),
        String(r.saId || ''),
        String(r.name || ''),
      ];
    });
    sheet
      .getRange(sheet.getLastRow() + 1, 1, newRows.length, TEE_TIMES_HEADERS.length)
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
    throw new Error('saveMatches needs { rows: [...] }');
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
      String(r.id || ''),
      Number(r.round) || 0,
      Number(r.slot) || 0,
      String(r.playerASaId || ''),
      String(r.playerBSaId || ''),
      String(r.winnerSaId || ''),
      String(r.result || ''),
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
