/*
  DeviceSchema.gs

  Deploy as: Apps Script Web App
  - Execute as: Me (script owner)
  - Who has access: Anyone (or Anyone within domain)

  This script supports JSONP via doGet to avoid browser CORS limitations.
  It creates (or updates) a sheet tab and writes header columns to row 1.

  Query params:
    action=createSchema
    token=YOUR_SHARED_TOKEN
    spreadsheetId=...
    sheetName=...
    headers=["COL1","COL2",...]
    callback=someFunctionName
*/

function jsonp(callbackName, payload) {
  var text = (callbackName || 'callback') + '(' + JSON.stringify(payload) + ')';
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getRequiredToken_() {
  // Set this in Script Properties: TOKEN
  // Apps Script editor: Project Settings -> Script properties
  var props = PropertiesService.getScriptProperties();
  return props.getProperty('TOKEN') || '';
}

function ensureSheet_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;
  return ss.insertSheet(sheetName);
}

function writeHeaders_(sheet, headers) {
  if (!headers || !headers.length) {
    throw new Error('headers is required');
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function listSheetNames_(ss) {
  var sheets = ss.getSheets();
  var names = [];
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    names.push(sh.getName());
  }
  return names;
}

function readHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol || lastCol < 1) return [];
  var values = sheet.getRange(1, 1, 1, lastCol).getValues();
  var row = (values && values.length) ? values[0] : [];
  var headers = [];
  for (var i = 0; i < row.length; i++) {
    var cell = row[i];
    var text = (cell === null || typeof cell === 'undefined') ? '' : String(cell);
    if (text.trim()) headers.push(text.trim());
  }
  return headers;
}

function coerceToString_(value) {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}

function appendRowByHeaders_(sheet, headers, dataObj) {
  if (!headers || !headers.length) {
    throw new Error('sheet has no headers');
  }
  var values = [];
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var raw = dataObj && Object.prototype.hasOwnProperty.call(dataObj, key) ? dataObj[key] : '';
    values.push(coerceToString_(raw));
  }
  sheet.appendRow(values);
  return sheet.getLastRow();
}

function parseNumber_(value) {
  var text = coerceToString_(value).trim();
  if (!text) return null;
  var n = Number(text);
  return isNaN(n) ? null : n;
}

function findRowByLocationLatLon_(sheet, headers, where) {
  if (!headers || !headers.length) {
    throw new Error('sheet has no headers');
  }

  var headerIndex = {};
  for (var i = 0; i < headers.length; i++) {
    headerIndex[headers[i]] = i;
  }

  if (typeof headerIndex.LOCATION !== 'number' || typeof headerIndex.LAT !== 'number' || typeof headerIndex.LON !== 'number') {
    throw new Error('sheet must include LOCATION, LAT, LON');
  }

  var expectedLocation = coerceToString_(where && where.LOCATION).trim();
  var expectedLat = parseNumber_(where && where.LAT);
  var expectedLon = parseNumber_(where && where.LON);
  if (!expectedLocation || expectedLat === null || expectedLon === null) {
    throw new Error('where must include LOCATION, LAT, LON');
  }

  var lastRow = sheet.getLastRow();
  if (!lastRow || lastRow < 2) return null;

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var location = coerceToString_(row[headerIndex.LOCATION]).trim();
    if (location !== expectedLocation) continue;

    var lat = parseNumber_(row[headerIndex.LAT]);
    var lon = parseNumber_(row[headerIndex.LON]);
    if (lat === null || lon === null) continue;

    // numeric match with small tolerance (floating storage)
    if (Math.abs(lat - expectedLat) > 1e-6) continue;
    if (Math.abs(lon - expectedLon) > 1e-6) continue;

    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = coerceToString_(row[c]);
    }
    return { rowNumber: r + 2, data: obj };
  }

  return null;
}

function deleteRowByLocationLatLon_(sheet, headers, where) {
  var match = findRowByLocationLatLon_(sheet, headers, where);
  if (!match) return null;

  sheet.deleteRow(match.rowNumber);
  return match.rowNumber;
}

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var callback = p.callback;

  try {
    if (!p.action) {
      return jsonp(callback, { ok: false, error: 'action is required' });
    }

    var requiredToken = getRequiredToken_();
    if (requiredToken) {
      if (!p.token || p.token !== requiredToken) {
        return jsonp(callback, { ok: false, error: 'Unauthorized' });
      }
    }

    var spreadsheetId = p.spreadsheetId;

    if (!spreadsheetId) {
      return jsonp(callback, { ok: false, error: 'spreadsheetId is required' });
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);

    if (p.action === 'listSchemas') {
      var names = listSheetNames_(ss);
      return jsonp(callback, { ok: true, spreadsheetId: spreadsheetId, sheets: names });
    }

    if (p.action === 'getHeaders') {
      var sheetNameForHeaders = p.sheetName;
      if (!sheetNameForHeaders) {
        return jsonp(callback, { ok: false, error: 'sheetName is required' });
      }

      var sheetForHeaders = ss.getSheetByName(sheetNameForHeaders);
      if (!sheetForHeaders) {
        return jsonp(callback, { ok: false, error: 'sheet not found' });
      }

      var headers = readHeaders_(sheetForHeaders);
      return jsonp(callback, { ok: true, spreadsheetId: spreadsheetId, sheetName: sheetNameForHeaders, headers: headers });
    }

    if (p.action === 'createSchema') {
      var sheetName = p.sheetName;
      var headersRaw = p.headers;

      if (!sheetName) {
        return jsonp(callback, { ok: false, error: 'sheetName is required' });
      }
      if (!headersRaw) {
        return jsonp(callback, { ok: false, error: 'headers is required' });
      }

      var headersToWrite = JSON.parse(headersRaw);
      if (!headersToWrite || !headersToWrite.length) {
        return jsonp(callback, { ok: false, error: 'headers must be a non-empty array' });
      }

      var sheet = ensureSheet_(ss, sheetName);
      writeHeaders_(sheet, headersToWrite);

      return jsonp(callback, { ok: true, spreadsheetId: spreadsheetId, sheetName: sheetName, headerCount: headersToWrite.length });
    }

    if (p.action === 'appendRow') {
      var sheetNameForAppend = p.sheetName;
      var dataRaw = p.data;

      if (!sheetNameForAppend) {
        return jsonp(callback, { ok: false, error: 'sheetName is required' });
      }
      if (!dataRaw) {
        return jsonp(callback, { ok: false, error: 'data is required' });
      }

      var sheetForAppend = ensureSheet_(ss, sheetNameForAppend);
      var headersForAppend = readHeaders_(sheetForAppend);
      if (!headersForAppend || !headersForAppend.length) {
        return jsonp(callback, { ok: false, error: 'sheet has no headers (createSchema first)' });
      }

      var dataObj = JSON.parse(dataRaw);
      if (!dataObj || typeof dataObj !== 'object') {
        return jsonp(callback, { ok: false, error: 'data must be a JSON object' });
      }

      var rowNumber = appendRowByHeaders_(sheetForAppend, headersForAppend, dataObj);
      return jsonp(callback, {
        ok: true,
        spreadsheetId: spreadsheetId,
        sheetName: sheetNameForAppend,
        rowNumber: rowNumber,
        columnCount: headersForAppend.length,
      });
    }

    if (p.action === 'findRow') {
      var sheetNameForFind = p.sheetName;
      var whereRaw = p.where;

      if (!sheetNameForFind) {
        return jsonp(callback, { ok: false, error: 'sheetName is required' });
      }
      if (!whereRaw) {
        return jsonp(callback, { ok: false, error: 'where is required' });
      }

      var sheetForFind = ss.getSheetByName(sheetNameForFind);
      if (!sheetForFind) {
        return jsonp(callback, { ok: false, error: 'sheet not found' });
      }

      var headersForFind = readHeaders_(sheetForFind);
      if (!headersForFind || !headersForFind.length) {
        return jsonp(callback, { ok: false, error: 'sheet has no headers (createSchema first)' });
      }

      var whereObj = JSON.parse(whereRaw);
      if (!whereObj || typeof whereObj !== 'object') {
        return jsonp(callback, { ok: false, error: 'where must be a JSON object' });
      }

      var match = findRowByLocationLatLon_(sheetForFind, headersForFind, whereObj);
      if (!match) {
        return jsonp(callback, { ok: true, spreadsheetId: spreadsheetId, sheetName: sheetNameForFind, found: false });
      }

      return jsonp(callback, {
        ok: true,
        spreadsheetId: spreadsheetId,
        sheetName: sheetNameForFind,
        found: true,
        rowNumber: match.rowNumber,
        data: match.data,
      });
    }

    if (p.action === 'deleteRow') {
      var sheetNameForDelete = p.sheetName;
      var whereRawForDelete = p.where;

      if (!sheetNameForDelete) {
        return jsonp(callback, { ok: false, error: 'sheetName is required' });
      }
      if (!whereRawForDelete) {
        return jsonp(callback, { ok: false, error: 'where is required' });
      }

      var sheetForDelete = ss.getSheetByName(sheetNameForDelete);
      if (!sheetForDelete) {
        return jsonp(callback, { ok: false, error: 'sheet not found' });
      }

      var headersForDelete = readHeaders_(sheetForDelete);
      if (!headersForDelete || !headersForDelete.length) {
        return jsonp(callback, { ok: false, error: 'sheet has no headers (createSchema first)' });
      }

      var whereObjForDelete = JSON.parse(whereRawForDelete);
      if (!whereObjForDelete || typeof whereObjForDelete !== 'object') {
        return jsonp(callback, { ok: false, error: 'where must be a JSON object' });
      }

      var deletedRowNumber = deleteRowByLocationLatLon_(sheetForDelete, headersForDelete, whereObjForDelete);
      if (!deletedRowNumber) {
        return jsonp(callback, { ok: true, spreadsheetId: spreadsheetId, sheetName: sheetNameForDelete, deleted: false });
      }

      return jsonp(callback, {
        ok: true,
        spreadsheetId: spreadsheetId,
        sheetName: sheetNameForDelete,
        deleted: true,
        rowNumber: deletedRowNumber,
      });
    }

    return jsonp(callback, { ok: false, error: 'Invalid action' });
  } catch (err) {
    var msg = (err && err.message) ? err.message : String(err);
    return jsonp(callback, { ok: false, error: msg });
  }
}
