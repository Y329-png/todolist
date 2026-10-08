(function () {
  'use strict';

  var STORAGE_KEY = 'todo-pwa-items-v1';
  var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  var els = {
    form: document.getElementById('add-form'),
    input: document.getElementById('todo-input'),
    chips: Array.prototype.slice.call(document.querySelectorAll('.chip')),
    laterRow: document.getElementById('later-row'),
    laterDate: document.getElementById('later-date'),
    laterClear: document.getElementById('later-clear'),
    list: document.getElementById('todo-list'),
    subtitle: document.getElementById('subtitle'),
    backupBtn: document.getElementById('backup-btn'),
    restoreBtn: document.getElementById('restore-btn'),
    restoreFile: document.getElementById('restore-file')
  };

  var state = {
    items: load(),
    due: 'today',
    laterDate: '',
    doneOpen: false,
    editingId: null
  };

  function toDateStr(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function todayStr(offset) {
    var d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return toDateStr(d);
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function parseDateStr(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function formatDateLabel(dateStr) {
    var d = parseDateStr(dateStr);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEKDAYS[d.getDay()];
  }

  function relativeDayLabel(dateStr) {
    if (dateStr === todayStr(0)) return '今天';
    if (dateStr === todayStr(-1)) return '昨天';
    return formatDateLabel(dateStr);
  }

  function dueToDate(due) {
    if (due === 'today') return todayStr(0);
    if (due === 'tomorrow') return todayStr(1);
    if (due === 'later') return state.laterDate || null;
    return null;
  }

  function groupOf(item) {
    if (!item.date) return 'later';
    var t = todayStr(0);
    var tm = todayStr(1);
    if (item.date < t) return 'overdue';
    if (item.date === t) return 'today';
    if (item.date === tm) return 'tomorrow';
    return 'later';
  }

  function addItem(text, due) {
    state.items.push({
      id: newId(),
      text: text,
      date: dueToDate(due),
      done: false,
      createdAt: Date.now(),
      completedAt: null
    });
    save();
    render();
  }

  function findItem(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function toggleDone(id) {
    var item = findItem(id);
    if (!item) return;
    item.done = !item.done;
    item.completedAt = item.done ? Date.now() : null;
    save();
    render();
  }

  function deleteItem(id) {
    var item = findItem(id);
    if (!item) return;
    if (!window.confirm('删除「' + item.text + '」？')) return;
    state.items = state.items.filter(function (i) { return i.id !== id; });
    save();
    render();
  }

  function clearDone() {
    var n = state.items.filter(function (i) { return i.done; }).length;
    if (n === 0) return;
    if (!window.confirm('清除 ' + n + ' 条已完成的待办？')) return;
    state.items = state.items.filter(function (i) { return !i.done; });
    save();
    render();
  }

  function startEdit(id) {
    state.editingId = id;
    render();
    var input = els.list.querySelector('.edit-input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function commitEdit(id) {
    var item = findItem(id);
    var input = els.list.querySelector('.edit-input');
    var dateInput = els.list.querySelector('.edit-date');
    if (item && input) {
      var text = input.value.trim();
      if (text) {
        item.text = text;
        item.date = dateInput && dateInput.value ? dateInput.value : null;
        save();
      }
    }
    state.editingId = null;
    render();
  }

  function cancelEdit() {
    state.editingId = null;
    render();
  }

  function makeRow(item) {
    var row = document.createElement('div');
    row.className = 'todo' + (item.done ? ' done' : '');

    var check = document.createElement('button');
    check.className = 'check';
    check.type = 'button';
    check.setAttribute('aria-label', item.done ? '标记为未完成' : '标记为完成');
    check.addEventListener('click', function () { toggleDone(item.id); });
    row.appendChild(check);

    var body = document.createElement('div');
    body.className = 'todo-body';
    row.appendChild(body);

    if (state.editingId === item.id) {
      var editRow = document.createElement('div');
      editRow.className = 'edit-row';

      var input = document.createElement('input');
      input.className = 'edit-input';
      input.type = 'text';
      input.value = item.text;
      input.maxLength = 200;
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') commitEdit(item.id);
        if (e.key === 'Escape') cancelEdit();
      });

      var dateInput = document.createElement('input');
      dateInput.className = 'edit-date';
      dateInput.type = 'date';
      dateInput.value = item.date || '';
      dateInput.setAttribute('aria-label', '选择日期');

      var clearDate = null;
      if (item.date) {
        clearDate = document.createElement('button');
        clearDate.className = 'link-btn';
        clearDate.type = 'button';
        clearDate.textContent = '清除';
        clearDate.addEventListener('click', function () { dateInput.value = ''; });
      }

      var save = document.createElement('button');
      save.className = 'link-btn';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () { commitEdit(item.id); });

      editRow.appendChild(input);
      editRow.appendChild(dateInput);
      if (clearDate) editRow.appendChild(clearDate);
      editRow.appendChild(save);
      body.appendChild(editRow);
    } else {
      var text = document.createElement('div');
      text.className = 'text';
      text.textContent = item.text;
      if (!item.done) {
        text.addEventListener('click', function () { startEdit(item.id); });
      }
      body.appendChild(text);

      if (item.date) {
        var dateLabel = document.createElement('div');
        var overdue = !item.done && item.date < todayStr(0);
        dateLabel.className = 'date-label' + (overdue ? ' overdue' : '');
        dateLabel.textContent = formatDateLabel(item.date);
        body.appendChild(dateLabel);
      }
    }

    var del = document.createElement('button');
    del.className = 'delete';
    del.type = 'button';
    del.setAttribute('aria-label', '删除');
    del.textContent = '×';
    del.addEventListener('click', function () { deleteItem(item.id); });
    row.appendChild(del);

    return row;
  }

  function makeSection(label, items, opts) {
    opts = opts || {};
    var section = document.createElement('section');
    section.className = 'section';

    var title = document.createElement('div');
    title.className = 'section-title' + (opts.overdue ? ' overdue' : '');

    var h2 = document.createElement('h2');
    h2.textContent = label;
    title.appendChild(h2);

    var right = document.createElement('div');
    var count = document.createElement('span');
    count.className = 'count';
    count.textContent = String(items.length);
    right.appendChild(count);

    title.appendChild(right);
    section.appendChild(title);

    var card = document.createElement('div');
    card.className = 'card';
    items.forEach(function (item) { card.appendChild(makeRow(item)); });
    section.appendChild(card);

    return section;
  }

  function makeDoneSection(done) {
    var section = document.createElement('section');
    section.className = 'section';

    var title = document.createElement('div');
    title.className = 'section-title';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'done-toggle';

    var arrow = document.createElement('span');
    arrow.className = 'done-arrow';
    arrow.textContent = state.doneOpen ? '▾' : '▸';
    toggle.appendChild(arrow);

    var h2 = document.createElement('h2');
    h2.textContent = '已完成';
    toggle.appendChild(h2);

    toggle.addEventListener('click', function () {
      state.doneOpen = !state.doneOpen;
      render();
    });
    title.appendChild(toggle);

    var right = document.createElement('div');
    var count = document.createElement('span');
    count.className = 'count';
    count.textContent = String(done.length);
    right.appendChild(count);

    var clear = document.createElement('button');
    clear.className = 'link-btn';
    clear.type = 'button';
    clear.textContent = '清除';
    clear.addEventListener('click', clearDone);
    right.appendChild(clear);

    title.appendChild(right);
    section.appendChild(title);

    if (state.doneOpen) {
      var byDay = {};
      var days = [];
      done.forEach(function (item) {
        var key = toDateStr(new Date(item.completedAt || 0));
        if (!byDay[key]) {
          byDay[key] = [];
          days.push(key);
        }
        byDay[key].push(item);
      });

      days.sort().reverse().forEach(function (key) {
        var dayLabel = document.createElement('div');
        dayLabel.className = 'done-day';
        dayLabel.textContent = relativeDayLabel(key) + ' · ' + byDay[key].length;
        section.appendChild(dayLabel);

        var card = document.createElement('div');
        card.className = 'card done-card';
        byDay[key].forEach(function (item) { card.appendChild(makeRow(item)); });
        section.appendChild(card);
      });
    }

    return section;
  }

  function render() {
    els.list.textContent = '';

    var pending = state.items.filter(function (i) { return !i.done; });
    var done = state.items
      .filter(function (i) { return i.done; })
      .sort(function (a, b) { return (b.completedAt || 0) - (a.completedAt || 0); });

    var groups = [
      { label: '已逾期', key: 'overdue', items: pending.filter(function (i) { return groupOf(i) === 'overdue'; }) },
      { label: '今天', key: 'today', items: pending.filter(function (i) { return groupOf(i) === 'today'; }) },
      { label: '明天', key: 'tomorrow', items: pending.filter(function (i) { return groupOf(i) === 'tomorrow'; }) },
      { label: '以后', key: 'later', items: pending.filter(function (i) { return groupOf(i) === 'later'; }) }
    ];

    var shown = 0;
    groups.forEach(function (g) {
      if (g.items.length === 0) return;
      shown++;
      els.list.appendChild(makeSection(g.label, g.items, { overdue: g.key === 'overdue' }));
    });

    if (done.length) {
      shown++;
      els.list.appendChild(makeDoneSection(done));
    }

    if (shown === 0) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '还没有待办事项。在上方输入，开始记录第一件事吧。';
      els.list.appendChild(empty);
    }

    updateSubtitle(pending.length);
  }

  function updateSubtitle(pendingCount) {
    var now = new Date();
    var dateStr = (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + WEEKDAYS[now.getDay()];
    els.subtitle.textContent = dateStr + ' · 还剩 ' + pendingCount + ' 件';
  }

  function exportBackup() {
    var blob = new Blob([JSON.stringify(state.items, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'todo-backup-' + todayStr(0) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var arr = JSON.parse(reader.result);
        if (!Array.isArray(arr)) throw new Error('not an array');
        var valid = arr.every(function (i) {
          return i && typeof i.text === 'string' && typeof i.done === 'boolean';
        });
        if (!valid) throw new Error('bad shape');
        if (!window.confirm('恢复备份将替换当前 ' + state.items.length + ' 条数据（备份含 ' + arr.length + ' 条），确定？')) return;
        state.items = arr.map(function (i) {
          return {
            id: typeof i.id === 'string' ? i.id : newId(),
            text: i.text,
            date: typeof i.date === 'string' ? i.date : null,
            done: i.done,
            createdAt: typeof i.createdAt === 'number' ? i.createdAt : Date.now(),
            completedAt: typeof i.completedAt === 'number' ? i.completedAt : null
          };
        });
        save();
        render();
        window.alert('恢复成功，共 ' + arr.length + ' 条。');
      } catch (e) {
        window.alert('备份文件格式不正确，恢复失败。');
      }
    };
    reader.readAsText(file);
  }

  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = els.input.value.trim();
    if (!text) {
      els.input.focus();
      return;
    }
    addItem(text, state.due);
    els.input.value = '';
    els.input.blur();
  });

  els.chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.due = chip.dataset.due;
      els.chips.forEach(function (c) { c.classList.toggle('active', c === chip); });
      var isLater = state.due === 'later';
      els.laterRow.hidden = !isLater;
      if (isLater) {
        els.laterDate.min = todayStr(0);
        els.laterDate.focus();
      } else {
        els.input.focus();
      }
    });
  });

  els.laterDate.addEventListener('change', function () {
    state.laterDate = els.laterDate.value;
    els.laterClear.hidden = !state.laterDate;
    els.input.focus();
  });

  els.laterClear.addEventListener('click', function () {
    els.laterDate.value = '';
    state.laterDate = '';
    els.laterClear.hidden = true;
    els.laterDate.focus();
  });

  els.backupBtn.addEventListener('click', exportBackup);
  els.restoreBtn.addEventListener('click', function () { els.restoreFile.click(); });
  els.restoreFile.addEventListener('change', function () {
    if (els.restoreFile.files.length) importBackup(els.restoreFile.files[0]);
    els.restoreFile.value = '';
  });

  render();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
