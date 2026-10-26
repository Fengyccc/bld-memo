// 数据模型与持久化（localStorage）
(function (global) {
  'use strict';

  var STORAGE_KEY = 'bld_memo_data_v2';
  // 帆式全读：A–Z 去掉 U、V，共 24 个字母
  var DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTWXYZ'.split('');

  // 归一化：去首尾空白，ASCII 小写转大写（中文等字符保持不变）
  function norm(s) {
    return String(s == null ? '' : s).trim().replace(/[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  function defaultData() {
    return { alphabet: DEFAULT_ALPHABET.slice(), dictionary: {} };
  }

  // 把词典条目统一为 { word, pron }；兼容旧的字符串值
  function normalizeEntry(v) {
    if (v && typeof v === 'object') {
      return {
        word: String(v.word == null ? '' : v.word).trim(),
        pron: String(v.pron == null ? '' : v.pron).trim()
      };
    }
    return { word: String(v == null ? '' : v).trim(), pron: '' };
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.alphabet) && parsed.dictionary && typeof parsed.dictionary === 'object') {
          var dict = {};
          for (var k in parsed.dictionary) {
            var nk = norm(k);
            if (!nk) continue;
            dict[nk] = normalizeEntry(parsed.dictionary[k]);
          }
          return { alphabet: parsed.alphabet.map(norm).filter(Boolean), dictionary: dict };
        }
      }
    } catch (e) { /* 忽略损坏数据，回退默认 */ }
    return defaultData();
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  // 生成有序字母对列表（含自身组合，供展示用）
  function allPairs(alphabet) {
    var pairs = [];
    for (var i = 0; i < alphabet.length; i++) {
      for (var j = 0; j < alphabet.length; j++) {
        pairs.push(alphabet[i] + alphabet[j]);
      }
    }
    return pairs;
  }

  // 把文本框内容解析成字母列表（按空格/逗号/换行/顿号分隔）
  function parseAlphabetText(text) {
    return String(text || '').split(/[\s,，、]+/).map(norm).filter(Boolean);
  }

  function alphabetToText(alphabet) {
    return alphabet.join(' ');
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // 是否运行在 Capacitor（安卓 WebView）环境内
  function isCapacitor() {
    return !!(global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Share);
  }

  // 导出：安卓 WebView 不支持 a[download] 下载，改用系统分享（可存到文件/网盘）；浏览器则正常下载
  function saveOrShareText(text, filename, mime) {
    if (isCapacitor()) {
      global.Capacitor.Plugins.Share.share({ title: filename, text: text }).catch(function () {});
      return;
    }
    downloadBlob(new Blob([text], { type: mime }), filename);
  }

  global.BLDStore = {
    STORAGE_KEY: STORAGE_KEY,
    norm: norm,
    defaultData: defaultData,
    normalizeEntry: normalizeEntry,
    loadData: loadData,
    saveData: saveData,
    allPairs: allPairs,
    parseAlphabetText: parseAlphabetText,
    alphabetToText: alphabetToText,
    downloadBlob: downloadBlob,
    isCapacitor: isCapacitor,
    saveOrShareText: saveOrShareText
  };
})(window);
