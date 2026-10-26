// 界面渲染与交互
(function (global) {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var state = BLDStore.loadData();
  var pendingConfirm = null;   // 弹窗「确认」时执行的动作
  var pendingFileKind = null;  // 文件选择后按哪种方式处理：'json' | 'excel'
  var selectedCode = null;     // 当前编辑面板对应的编码

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function esc(code) { return CSS.escape(code); }

  // ---------- 标签切换 ----------
  function initTabs() {
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === name + '-view'); });
    if (name === 'settings') renderSettings();
  }

  // ---------- 查询 ----------
  function parseSequence(raw) {
    // 去空白与常见分隔符，剩下的每个字符视为一个符号
    var cleaned = String(raw || '').replace(/[\s,，、;；:：.。\-_/\\|]+/g, '');
    var symbols = cleaned.split('').map(BLDStore.norm);
    var pairs = [];
    for (var i = 0; i + 1 < symbols.length; i += 2) pairs.push(symbols[i] + symbols[i + 1]);
    var leftover = symbols.length % 2 === 1 ? symbols[symbols.length - 1] : null;
    return { pairs: pairs, leftover: leftover };
  }

  function makeItem(code, inAlpha, leftover) {
    var entry = state.dictionary[code];
    var item = el('div', 'pair-item' + (leftover ? ' leftover' : ''));
    item.appendChild(el('span', 'pair-token', code));
    if (entry && (entry.word || entry.pron)) {
      if (entry.word) item.appendChild(el('span', 'pair-word', entry.word));
      if (entry.pron) item.appendChild(el('span', 'pair-pron', entry.pron));
    } else {
      item.appendChild(el('span', 'pair-word missing', inAlpha ? '未设置' : '—'));
    }
    if (!inAlpha) item.appendChild(el('span', 'pair-warn', '不在字母表'));
    return item;
  }

  function renderQuery() {
    var raw = $('#seq-input').value;
    var results = $('#query-results');
    results.innerHTML = '';
    if (!raw.trim()) {
      results.appendChild(el('p', 'empty-hint', '输入字母对或整串序列，自动按两个字母分组，末尾单个字母单独查询。'));
      return;
    }
    var parsed = parseSequence(raw);
    if (!parsed.pairs.length && !parsed.leftover) {
      results.appendChild(el('p', 'empty-hint', '未识别到字母。'));
      return;
    }
    var alphaSet = new Set(state.alphabet);
    var list = el('div', 'pair-list');
    parsed.pairs.forEach(function (pair) {
      var inAlpha = alphaSet.has(pair[0]) && alphaSet.has(pair[1]);
      list.appendChild(makeItem(pair, inAlpha, false));
    });
    if (parsed.leftover) {
      list.appendChild(makeItem(parsed.leftover, alphaSet.has(parsed.leftover), true));
    }
    results.appendChild(list);
  }

  function renderReverse() {
    var kw = BLDStore.norm($('#reverse-input').value).toLowerCase();
    var results = $('#reverse-results');
    results.innerHTML = '';
    if (!kw) return;
    var matches = [];
    for (var code in state.dictionary) {
      var e = state.dictionary[code];
      if (e && (String(e.word).toLowerCase().indexOf(kw) !== -1 || String(e.pron || '').toLowerCase().indexOf(kw) !== -1)) {
        matches.push(code);
      }
    }
    matches.sort();
    if (!matches.length) { results.appendChild(el('p', 'empty-hint', '没有匹配的联想词。')); return; }
    var list = el('div', 'pair-list');
    var shown = matches.slice(0, 200);
    shown.forEach(function (code) {
      var e = state.dictionary[code];
      var item = el('div', 'pair-item');
      item.appendChild(el('span', 'pair-token', code));
      if (e.word) item.appendChild(el('span', 'pair-word', e.word));
      if (e.pron) item.appendChild(el('span', 'pair-pron', e.pron));
      list.appendChild(item);
    });
    if (matches.length > shown.length) {
      list.appendChild(el('p', 'empty-hint', '… 共 ' + matches.length + ' 条，仅显示前 ' + shown.length + ' 条'));
    }
    results.appendChild(list);
  }

  // ---------- 设置 ----------
  function renderSettings() {
    $('#alphabet-input').value = BLDStore.alphabetToText(state.alphabet);
    updateAlphabetCount();
    renderSingleRow();
    renderGrid();
    updateProgress();
    hideEditPanel();
  }

  function updateAlphabetCount() {
    var n = state.alphabet.length;
    $('#alphabet-count').textContent = n + ' 个字母，共 ' + (n * n) + ' 个编码（' + n + ' 个单字母 + ' + (n * (n - 1)) + ' 个字母对）';
  }

  function renderSingleRow() {
    var row = $('#single-row');
    row.innerHTML = '';
    state.alphabet.forEach(function (ch) {
      var e = state.dictionary[ch];
      var cell = el('button', 'single-cell' + (e && e.word ? ' filled' : ''));
      cell.type = 'button';
      cell.dataset.code = ch;
      cell.title = ch + (e && e.word ? '：' + e.word : '');
      cell.appendChild(el('span', 'sc-letter', ch));
      cell.appendChild(el('span', 'sc-word', e && e.word ? e.word : ''));
      row.appendChild(cell);
    });
  }

  function renderGrid() {
    var grid = $('#dict-grid');
    grid.innerHTML = '';
    var alpha = state.alphabet;
    if (!alpha.length) {
      grid.appendChild(el('p', 'empty-hint', '请先在「字母表」中设置字母。'));
      return;
    }
    var table = el('table', 'grid-table');
    var thead = el('thead');
    var hr = el('tr');
    hr.appendChild(el('th'));
    alpha.forEach(function (b) { hr.appendChild(el('th', '', b)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el('tbody');
    alpha.forEach(function (a) {
      var tr = el('tr');
      tr.appendChild(el('th', '', a));
      alpha.forEach(function (b) {
        if (a === b) {
          var td0 = el('td', 'self');
          td0.textContent = '·';
          td0.title = '自身组合（不使用）';
          tr.appendChild(td0);
          return;
        }
        var pair = a + b;
        var e = state.dictionary[pair];
        var td = el('td', e && e.word ? 'filled' : 'empty');
        td.dataset.code = pair;
        td.title = pair + (e && e.word ? '：' + e.word : '');
        if (e && e.word) td.textContent = e.word;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    grid.appendChild(table);
  }

  function updateProgress() {
    var n = state.alphabet.length;
    var total = n * n; // 单字母 n + 字母对 n*(n-1)
    var filled = 0;
    state.alphabet.forEach(function (a) {
      if (state.dictionary[a]) filled++;
      state.alphabet.forEach(function (b) {
        if (a !== b && state.dictionary[a + b]) filled++;
      });
    });
    var pct = total ? Math.round((filled / total) * 100) : 0;
    $('#progress').textContent = '已填 ' + filled + ' / ' + total + '（' + pct + '%）';
  }

  function applyAlphabet() {
    var tokens = BLDStore.parseAlphabetText($('#alphabet-input').value);
    var seen = new Set();
    var alphabet = [];
    var skipped = [];
    tokens.forEach(function (t) {
      if (t.length !== 1) { skipped.push(t); return; }
      if (!seen.has(t)) { seen.add(t); alphabet.push(t); }
    });
    if (!alphabet.length) { alert('字母表不能为空。'); return; }
    if (skipped.length) alert('以下内容被跳过（需为单个字符）：' + skipped.join('、'));
    state.alphabet = alphabet;
    BLDStore.saveData(state);
    renderSettings();
    renderQuery();
  }

  // ---------- 编辑面板 ----------
  function selectCell(code) {
    selectedCode = code;
    document.querySelectorAll('.selected').forEach(function (n) { n.classList.remove('selected'); });
    var sc = document.querySelector('.single-cell[data-code="' + esc(code) + '"]');
    var td = document.querySelector('td[data-code="' + esc(code) + '"]');
    if (sc) sc.classList.add('selected');
    if (td) td.classList.add('selected');
    var e = state.dictionary[code] || {};
    $('#edit-code').textContent = code;
    $('#edit-word').value = e.word || '';
    $('#edit-pron').value = e.pron || '';
    $('#edit-panel').classList.remove('hidden');
    $('#edit-word').focus();
  }

  function updateCellDisplay(code) {
    var e = state.dictionary[code];
    var word = e && e.word ? e.word : '';
    var sc = document.querySelector('.single-cell[data-code="' + esc(code) + '"]');
    if (sc) {
      var w = sc.querySelector('.sc-word');
      if (w) w.textContent = word;
      sc.classList.toggle('filled', !!word);
    }
    var td = document.querySelector('td[data-code="' + esc(code) + '"]');
    if (td) {
      td.textContent = word;
      td.classList.toggle('filled', !!word);
      td.classList.toggle('empty', !word);
    }
  }

  function saveEdit() {
    if (!selectedCode) return;
    var word = $('#edit-word').value.trim();
    var pron = $('#edit-pron').value.trim();
    if (word || pron) state.dictionary[selectedCode] = { word: word, pron: pron };
    else delete state.dictionary[selectedCode];
    BLDStore.saveData(state);
    updateCellDisplay(selectedCode);
    updateProgress();
  }

  function clearEdit() {
    if (!selectedCode) return;
    delete state.dictionary[selectedCode];
    BLDStore.saveData(state);
    $('#edit-word').value = '';
    $('#edit-pron').value = '';
    updateCellDisplay(selectedCode);
    updateProgress();
  }

  function hideEditPanel() {
    selectedCode = null;
    $('#edit-panel').classList.add('hidden');
    document.querySelectorAll('.selected').forEach(function (n) { n.classList.remove('selected'); });
  }

  function initEditing() {
    $('#single-row').addEventListener('click', function (e) {
      var c = e.target.closest('.single-cell[data-code]');
      if (c) selectCell(c.dataset.code);
    });
    $('#dict-grid').addEventListener('click', function (e) {
      var td = e.target.closest('td[data-code]');
      if (td) selectCell(td.dataset.code);
    });
    $('#edit-save').addEventListener('click', saveEdit);
    $('#edit-clear').addEventListener('click', clearEdit);
    $('#edit-cancel').addEventListener('click', hideEditPanel);
    ['#edit-word', '#edit-pron'].forEach(function (sel) {
      $(sel).addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); saveEdit(); }
        else if (ev.key === 'Escape') hideEditPanel();
      });
    });
  }

  // ---------- 数据管理 ----------
  function exportJSON() {
    BLDStore.saveOrShareText(JSON.stringify(state, null, 2), '盲拧联想词数据.json', 'application/json;charset=utf-8');
  }

  function exportExcel() {
    var rows = [['编码', '联想词', '读音']];
    var alpha = state.alphabet;
    alpha.forEach(function (a) {
      var e = state.dictionary[a];
      if (e) rows.push([a, e.word || '', e.pron || '']);
    });
    alpha.forEach(function (a) {
      alpha.forEach(function (b) {
        if (a === b) return;
        var p = a + b;
        var e = state.dictionary[p];
        if (e) rows.push([p, e.word || '', e.pron || '']);
      });
    });
    BLDExcel.downloadExcel(rows, '盲拧联想词.xlsx');
  }

  function importJSONFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var dict = parsed.dictionary && typeof parsed.dictionary === 'object' ? parsed.dictionary : null;
        var alpha = Array.isArray(parsed.alphabet) ? parsed.alphabet.map(BLDStore.norm).filter(Boolean) : null;
        if (!dict && !alpha) { alert('JSON 中没有可识别的数据（缺少 alphabet 或 dictionary）。'); return; }
        var normDict = null;
        if (dict) {
          normDict = {};
          for (var k in dict) {
            var nk = BLDStore.norm(k);
            if (nk) normDict[nk] = BLDStore.normalizeEntry(dict[k]);
          }
        }
        var summary = '将导入：字母表 ' + (alpha ? alpha.length + ' 个字母' : '（不更改）')
          + '，联想词 ' + (normDict ? Object.keys(normDict).length + ' 条' : '（不更改）') + '。';
        showConfirm(summary, '导入 JSON', function () {
          if (alpha) state.alphabet = alpha;
          if (normDict) state.dictionary = normDict;
          BLDStore.saveData(state);
          renderSettings(); renderQuery(); renderReverse();
        });
      } catch (e) { alert('JSON 解析失败：' + e.message); }
    };
    reader.onerror = function () { alert('读取文件失败'); };
    reader.readAsText(file, 'utf-8');
  }

  function resetData() {
    showConfirm('将清空所有联想词并恢复默认字母表（A–Z 去掉 U、V，共 24 个字母）。此操作不可撤销。', '恢复默认', function () {
      state = BLDStore.defaultData();
      BLDStore.saveData(state);
      renderSettings(); renderQuery(); renderReverse();
    });
  }

  // ---------- Excel 导入 ----------
  function importExcelFile(file) {
    BLDExcel.parseFile(file).then(function (rows) {
      if (!rows.length) { alert('没有读取到任何数据行。请确认第一列为编码、第二列为联想词。'); return; }
      showExcelPreview(rows);
    }).catch(function (err) { alert(err.message || String(err)); });
  }

  function validateRows(rows) {
    var alphaSet = new Set(state.alphabet);
    var seen = new Set();
    var result = [];
    rows.forEach(function (r) {
      var entry = { code: r.code, word: r.word, pron: r.pron, error: null, dup: false };
      var c = entry.code;
      if (c.length !== 1 && c.length !== 2) {
        entry.error = '编码应为 1 或 2 个字符';
      } else {
        for (var i = 0; i < c.length; i++) {
          if (!alphaSet.has(c[i])) { entry.error = '包含字母表之外的字符：' + c[i]; break; }
        }
      }
      if (!entry.error && seen.has(c)) entry.dup = true;
      seen.add(c);
      result.push(entry);
    });
    return result;
  }

  function showExcelPreview(rows) {
    var entries = validateRows(rows);
    var valid = entries.filter(function (e) { return !e.error; });
    var invalid = entries.filter(function (e) { return e.error; });
    var dups = valid.filter(function (e) { return e.dup; });

    $('#modal-title').textContent = 'Excel 导入预览';
    $('#modal-summary').textContent = '共 ' + entries.length + ' 行：有效 ' + valid.length + '，无效 ' + invalid.length
      + (dups.length ? '，重复 ' + dups.length + '（以最后一条为准）' : '') + '。导入会合并到现有联想词（同名编码覆盖）。';

    var list = $('#modal-list');
    list.innerHTML = '';
    var cap = 300;
    var shown = entries.slice(0, cap);
    shown.forEach(function (e) {
      var item = el('div', 'modal-item' + (e.error ? ' error' : (e.dup ? ' dup' : '')));
      item.appendChild(el('span', 'mpair', e.code));
      item.appendChild(el('span', 'mword', (e.word || '（空）') + (e.pron ? ' · ' + e.pron : '')));
      if (e.error) item.appendChild(el('span', 'mtag', e.error));
      else if (e.dup) item.appendChild(el('span', 'mtag', '重复'));
      list.appendChild(item);
    });
    if (entries.length > cap) list.appendChild(el('p', 'empty-hint', '… 还有 ' + (entries.length - cap) + ' 行未显示'));

    pendingConfirm = function () {
      if (!valid.length) { alert('没有有效数据可导入。'); return; }
      valid.forEach(function (e) {
        if (e.word || e.pron) state.dictionary[e.code] = { word: e.word, pron: e.pron };
        else delete state.dictionary[e.code];
      });
      BLDStore.saveData(state);
      renderSettings(); renderQuery(); renderReverse();
    };
    openModal();
  }

  // ---------- 弹窗 ----------
  function openModal() { $('#modal').classList.remove('hidden'); }
  function closeModal() { $('#modal').classList.add('hidden'); pendingConfirm = null; }

  function showConfirm(summary, title, onConfirm) {
    $('#modal-title').textContent = title;
    $('#modal-summary').textContent = summary;
    $('#modal-list').innerHTML = '';
    pendingConfirm = onConfirm;
    openModal();
  }

  function initModal() {
    $('#modal-confirm').addEventListener('click', function () {
      var fn = pendingConfirm;
      closeModal();
      if (fn) fn();
    });
    $('#modal-cancel').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal')) closeModal(); });
  }

  // ---------- 文件选择 ----------
  function initFileInput() {
    var input = $('#file-input');
    $('#import-json').addEventListener('click', function () {
      pendingFileKind = 'json';
      input.accept = '.json';
      input.click();
    });
    $('#import-excel').addEventListener('click', function () {
      pendingFileKind = 'excel';
      input.accept = '.xlsx,.xls,.csv';
      input.click();
    });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      var kind = pendingFileKind;
      pendingFileKind = null;
      input.value = '';
      if (!file) return;
      if (kind === 'json') importJSONFile(file);
      else importExcelFile(file);
    });
  }

  // ---------- 初始化 ----------
  function init() {
    initTabs();
    initEditing();
    initModal();
    initFileInput();
    $('#seq-input').addEventListener('input', renderQuery);
    $('#reverse-input').addEventListener('input', renderReverse);
    $('#apply-alphabet').addEventListener('click', applyAlphabet);
    $('#export-json').addEventListener('click', exportJSON);
    $('#export-excel').addEventListener('click', exportExcel);
    $('#reset-data').addEventListener('click', resetData);
    $('#download-template').addEventListener('click', function () { BLDExcel.downloadTemplate(); });
    renderQuery();
    renderSettings();
  }

  init();
})(window);
