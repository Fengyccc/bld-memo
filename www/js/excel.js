// Excel / CSV 导入解析、导出与模板下载
(function (global) {
  'use strict';

  // 注意：不含 'no'——编码「NO」（字母 N+O）转小写后是 'no'，会被误判为表头而跳过
  var HEADER = ['编码', '联想词', '读音', '字母', '字母对', '拼音', '发音', 'code', 'word', 'pron', 'pronunciation'];

  function hasXLSX() {
    return typeof XLSX !== 'undefined';
  }

  // 读取文件，解析为 [{ code, word, pron }]（原始数据，未做字母表校验）
  function parseFile(file) {
    var name = String(file.name || '').toLowerCase();
    return new Promise(function (resolve, reject) {
      if (name.endsWith('.csv') || name.endsWith('.txt')) {
        var r = new FileReader();
        r.onload = function () { resolve(rowsToEntries(parseCSV(String(r.result)))); };
        r.onerror = function () { reject(new Error('读取文件失败')); };
        r.readAsText(file, 'utf-8');
      } else if (hasXLSX()) {
        var r2 = new FileReader();
        r2.onload = function () {
          try {
            var wb = XLSX.read(r2.result, { type: 'array' });
            var sheet = wb.Sheets[wb.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            resolve(rowsToEntries(rows));
          } catch (e) {
            reject(new Error('Excel 解析失败：' + e.message));
          }
        };
        r2.onerror = function () { reject(new Error('读取文件失败')); };
        r2.readAsArrayBuffer(file);
      } else {
        reject(new Error('未加载 SheetJS 库，无法解析 .xlsx 文件。请改用 .csv，或补齐 lib/xlsx.full.min.js。'));
      }
    });
  }

  // 二维数组 → [{ code, word, pron }]。每行按 3 列一组解析（编码/联想词/读音），兼容 2、3、6 列格式。
  function rowsToEntries(rows) {
    var out = [];
    for (var i = 0; i < (rows || []).length; i++) {
      var row = rows[i];
      if (!Array.isArray(row)) continue;
      for (var off = 0; off < row.length; off += 3) {
        var code = BLDStore.norm(row[off]);
        if (!code) continue;
        if (HEADER.indexOf(code.toLowerCase()) !== -1) continue; // 表头行
        var word = String(row[off + 1] == null ? '' : row[off + 1]).trim();
        var pron = String(row[off + 2] == null ? '' : row[off + 2]).trim();
        if (pron === '0' || pron === '0.0') pron = ''; // 「0」表示无读音
        out.push({ code: code, word: word, pron: pron });
      }
    }
    return out;
  }

  // 简单 CSV 解析（支持引号包裹、双引号转义）
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // 去 BOM
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else if (c !== '\r') {
        field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // 下载二维数组为 xlsx（无 SheetJS 时退化为 csv）
  function downloadExcel(rows, filename) {
    if (BLDStore.isCapacitor()) {
      // 安卓 WebView 无法直接下载文件，导出为 CSV 文本并唤起系统分享
      var csvText = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
      BLDStore.saveOrShareText(csvText, filename.replace(/\.xlsx$/i, '.csv'), 'text/csv;charset=utf-8');
      return;
    }
    if (hasXLSX()) {
      var ws = XLSX.utils.aoa_to_sheet(rows);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '联想词');
      var buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      BLDStore.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
    } else {
      var csv = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
      BLDStore.downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename.replace(/\.xlsx$/i, '.csv'));
    }
  }

  function downloadTemplate() {
    downloadExcel([
      ['编码', '联想词', '读音'],
      ['A', '圣诞帽', ''],
      ['AB', 'Angelababy', 'bēi'],
      ['CD', '菜刀', 'dāo']
    ], '联想词模板.xlsx');
  }

  function csvCell(v) {
    var s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  global.BLDExcel = {
    hasXLSX: hasXLSX,
    parseFile: parseFile,
    rowsToEntries: rowsToEntries,
    parseCSV: parseCSV,
    downloadTemplate: downloadTemplate,
    downloadExcel: downloadExcel
  };
})(window);
