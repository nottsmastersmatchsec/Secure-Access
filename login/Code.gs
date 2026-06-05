const SHEET_NON_AVAIL = "Players Non-Availability Dates";
const SHEET_PLAYERS = "All";

const NON_AVAIL_HEADERS = [
  "Status",
  "Version",
  "Event",
  "Age Group",
  "Start Date & Time",
  "End Date & Time",
  "Player Name",
  "Player Email",
  "Event ID"
];

// Players sheet headers (from "All" tab)
const COL_BE_NUMBER = "BE Number";
const COL_FIRSTNAME = "Firstname";
const COL_SURNAME = "Surname";
const COL_EMAIL = "Email Address";
const COL_AGE_GROUP = "Age Group";
const COL_CAPTAIN_SELECTOR = "Captain / Selector";

function doGet(e) {
  const action = e.parameter.action;
  if (action === "getAvailability") {
    return getAvailability(e.parameter.email);
  }
  if (action === "getAllAvailability") {
    return getAllAvailability();
  }
  if (action === "getProfile") {
    return getProfile(e.parameter.email);
  }
  return ContentService.createTextOutput("Unknown action");
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if (action === "addAvailability") {
    addAvailability(body.data);
    return ContentService.createTextOutput("OK");
  }

  if (action === "deleteAvailability") {
    deleteAvailability(body.eventId);
    return ContentService.createTextOutput("OK");
  }

  return ContentService.createTextOutput("Unknown action");
}

function getNonAvailSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NON_AVAIL);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NON_AVAIL);
    sheet.getRange(1, 1, 1, NON_AVAIL_HEADERS.length).setValues([NON_AVAIL_HEADERS]);
  }
  return sheet;
}

function getPlayersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PLAYERS);
  if (!sheet) {
    throw new Error('Players sheet "All" not found');
  }
  return sheet;
}

// ---- PROFILE / ACCESS CONTROL ----

function getProfile(email) {
  const profile = lookupPlayerByEmail(email);
  const output = profile || { allowed: false };

  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function lookupPlayerByEmail(email) {
  if (!email) return null;
  const sheet = getPlayersSheet();
  const values = sheet.getDataRange().getValues();
  const headerRow = values[0];
  const rows = values.slice(1);

  const idx = {};
  headerRow.forEach((h, i) => idx[h] = i);

  const emailLower = email.toString().toLowerCase();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowEmail = (row[idx[COL_EMAIL]] || "").toString().toLowerCase();
    if (rowEmail === emailLower) {
      const first = row[idx[COL_FIRSTNAME]] || "";
      const surname = row[idx[COL_SURNAME]] || "";
      const ageGroup = row[idx[COL_AGE_GROUP]] || "";
      const roleRaw = row[idx[COL_CAPTAIN_SELECTOR]] || "";
      const role = roleRaw.toString().trim(); // "Captain", "Selector", or ""

      return {
        allowed: true,
        displayName: (first + " " + surname).trim() || email,
        ageGroup: ageGroup,
        role: role
      };
    }
  }

  return null;
}

// ---- NON-AVAILABILITY ----

function addAvailability(data) {
  const sheet = getNonAvailSheet();
  const lastRow = sheet.getLastRow();
  const eventId = Utilities.getUuid();

  const row = [
    data.status || "Active",
    data.version || "1.0",
    data.event || "Unavailable",
    data.ageGroup,
    data.startDateTime,
    data.endDateTime,
    data.playerName,
    data.playerEmail,
    eventId
  ];

  sheet.getRange(lastRow + 1, 1, 1, NON_AVAIL_HEADERS.length).setValues([row]);
}

function getAvailability(email) {
  const sheet = getNonAvailSheet();
  const values = sheet.getDataRange().getValues();
  const headerRow = values[0];
  const rows = values.slice(1);

  const idx = {};
  headerRow.forEach((h, i) => idx[h] = i);

  const result = rows
    .filter(r => r[idx["Player Email"]] === email)
    .map(r => ({
      status: r[idx["Status"]],
      version: r[idx["Version"]],
      event: r[idx["Event"]],
      ageGroup: r[idx["Age Group"]],
      startDateTime: r[idx["Start Date & Time"]],
      endDateTime: r[idx["End Date & Time"]],
      playerName: r[idx["Player Name"]],
      playerEmail: r[idx["Player Email"]],
      eventId: r[idx["Event ID"]]
    }));

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllAvailability() {
  const sheet = getNonAvailSheet();
  const values = sheet.getDataRange().getValues();
  const headerRow = values[0];
  const rows = values.slice(1);

  const idx = {};
  headerRow.forEach((h, i) => idx[h] = i);

  const result = rows.map(r => ({
    status: r[idx["Status"]],
    version: r[idx["Version"]],
    event: r[idx["Event"]],
    ageGroup: r[idx["Age Group"]],
    startDateTime: r[idx["Start Date & Time"]],
    endDateTime: r[idx["End Date & Time"]],
    playerName: r[idx["Player Name"]],
    playerEmail: r[idx["Player Email"]],
    eventId: r[idx["Event ID"]]
  }));

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function deleteAvailability(eventId) {
  const sheet = getNonAvailSheet();
  const values = sheet.getDataRange().getValues();
  const headerRow = values[0];
  const rows = values.slice(1);

  const idxEventId = headerRow.indexOf("Event ID");
  if (idxEventId === -1) return;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][idxEventId] === eventId) {
      sheet.deleteRow(i + 2); // header + 1-based index
      break;
    }
  }
}
