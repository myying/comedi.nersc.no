// Used on the work progress page (full table) and the home page (task count only).
fetch('data/innovations.json').then(function (res) { return res.json(); }).then(function (data) {
  var KIND = { D: 'Initial implementation', L: 'Shared as a module', Y: 'Shared through a new interface', B: 'Already available' };
  var STATUS = { planned: 'Planned', progress: 'In progress', done: 'Done' };
  var table = document.getElementById('p-table');
  var detail = document.getElementById('p-detail');
  var rowIndex = {}; data.rows.forEach(function (r, i) { rowIndex[r.name] = i; });
  var colIndex = {}; data.cols.forEach(function (c, i) { colIndex[c] = i; });
  var tasks = [], byCell = {};
  var ifaceStatus = {}, ifaceNote = {};   // from interfaces.csv, the central switch per interface

  // progress.csv: innovation,mfc,software,kind,interface,source,demo,status,demo_done,note (software may list several, separated by ;)
  // status 'via interface' means the task follows its interface's status in interfaces.csv (interface,status,note)
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { f += '"'; i++; }
        else if (ch === '"') q = false;
        else f += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(f); f = ''; if (row.join('') !== '') rows.push(row); row = [];
      } else f += ch;
    }
    row.push(f); if (row.join('') !== '') rows.push(row);
    var head = rows.shift().map(function (h) { return h.trim().toLowerCase(); });
    return rows.map(function (r) {
      var o = {}; head.forEach(function (h, i) { o[h] = (r[i] || '').trim(); }); return o;
    });
  }

  function load(list) {
    tasks = []; byCell = {};
    list.forEach(function (t) {
      var ri = rowIndex[t.innovation];
      if (ri === undefined) return;
      var status = (t.status || 'planned').toLowerCase();
      if (status === 'finished' || status === 'complete' || status === 'completed') status = 'done';
      if (status === 'in progress' || status === 'ongoing') status = 'progress';
      if (/^via/.test(status)) status = 'via';                     // follows interfaces.csv
      if (!STATUS[status] && status !== 'via') status = 'planned';
      var task = { innovation: t.innovation, row: ri, mfc: t.mfc, software: (t.software || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean),
                   kind: (t.kind || '').toLowerCase(), iface: t.interface || '', source: t.source || '', status: status, demo: /^y/i.test(t.demo), demoDone: /^y/i.test(t.demo_done), note: t.note || '' };
      tasks.push(task);
      [task.mfc].concat(task.software).forEach(function (c) {
        if (colIndex[c] === undefined) return;
        var k = ri + '|' + colIndex[c];
        (byCell[k] = byCell[k] || []).push(task);
      });
    });
  }

  function normStatus(s) {
    s = (s || 'planned').toLowerCase();
    if (s === 'finished' || s === 'complete' || s === 'completed') return 'done';
    if (s === 'in progress' || s === 'ongoing') return 'progress';
    return STATUS[s] ? s : 'planned';
  }
  function ifStatus(name) { return ifaceStatus[name] || 'planned'; }
  // a task's own status, or its interface's status when it is marked 'via interface'
  function eff(task) { return task.status === 'via' ? ifStatus(task.iface) : task.status; }
  // yellow cells always show the state of the interface they rely on
  function cellTaskStatus(task, code) { return code[0] === 'Y' && task.iface ? ifStatus(task.iface) : eff(task); }

  // a row's tool becomes available to others once one of its initial implementations is done
  function rowReady(ri) {
    return tasks.some(function (t) { return t.row === ri && t.kind === 'implementation' && eff(t) === 'done'; });
  }

  function cellStatus(list, code) {
    var s = list.map(function (t) { return cellTaskStatus(t, code); });
    if (s.every(function (x) { return x === 'done'; })) return 'done';
    if (s.some(function (x) { return x !== 'planned'; })) return 'progress';
    return 'planned';
  }

  function render() {
    var h = '<thead><tr class="grp"><th></th><th colspan="' + data.split + '">MFCs</th><th class="sep"></th>' +
            '<th colspan="' + (data.cols.length - data.split) + '">DA software</th></tr><tr><th></th>';
    data.cols.forEach(function (c, i) {
      if (i === data.split) h += '<th class="sep"></th>';
      h += '<th class="vert" scope="col">' + c + '</th>';
    });
    h += '</tr></thead><tbody>';
    var lastGroup = '';
    data.rows.forEach(function (r, ri) {
      if (r.group !== lastGroup) {
        h += '<tr><th class="path" colspan="' + (data.cols.length + 2) + '">' + r.group + '</th></tr>';
        lastGroup = r.group;
      }
      h += '<tr><th class="row" scope="row">' + r.name + '</th>';
      r.cells.forEach(function (code, ci) {
        if (ci === data.split) h += '<td class="sep"></td>';
        if (code === '-') {
          h += '<td class="e"><button type="button" data-r="' + ri + '" data-c="' + ci + '" aria-label="' + r.name + ', ' + data.cols[ci] + ': not a planned activity"></button></td>';
          return;
        }
        var list = byCell[ri + '|' + ci] || [];
        var mark = '', state;
        if (code[0] === 'B') state = 'avail';                         // capability that already exists
        else if (list.length) state = 'st-' + cellStatus(list, code);
        else if (code[0] === 'L') state = rowReady(ri) ? 'avail' : 'e'; // shared once the tool is built
        else state = 'e';
        var demos = list.filter(function (t) { return t.demo; });
        if (state === 'st-planned') state = 'e';                     // nothing is drawn until work starts
        if (demos.length) {
          if (demos.every(function (t) { return t.demoDone; })) mark = '<b class="xk" aria-label="demonstration complete">X</b>';
        }
        h += '<td class="c-' + code[0] + ' ' + state + '"><button type="button" data-r="' + ri + '" data-c="' + ci + '" aria-label="' +
             r.name + ', ' + data.cols[ci] + '">' + mark + '</button></td>';
      });
      h += '</tr>';
    });
    if (table) table.innerHTML = h + '</tbody>';
    summary();
  }

  var loaded = false;
  function summary() {
    var ps = document.getElementById('p-summary');
    if (!ps) ps = {};   // home page: only the task count below is shown
    if (!loaded) { ps.innerHTML = '<div class="p-sum"><div class="lbl">All tasks</div><div class="val"><small>Loading tasks&hellip;</small></div></div>'; return; }
    function card(label, n, extra) {
      var total = n.planned + n.progress + n.done, d = total || 1;
      return '<div class="p-sum"><div class="lbl">' + label + '</div><div class="val">' + n.done + '/' + total +
             '<small>done &middot; ' + n.progress + ' in progress</small></div><div class="demo-line">' + extra + '</div>' +
             '<div class="p-bar"><span class="b-done" style="width:' + (100 * n.done / d) + '%"></span>' +
             '<span class="b-progress" style="width:' + (100 * n.progress / d) + '%"></span></div></div>';
    }
    // one card per kind of task; interface tasks count under their kind
    var OBS = 'New observation operators';
    var groups = [['Core methods', function (r) { return r.path === 1; }],
                  ['Modular tools', function (r) { return r.path === 2 && r.group !== OBS; }],
                  ['Observation operators', function (r) { return r.group === OBS; }],
                  ['Model-specific', function (r) { return r.path === 3; }]];
    var html = groups.map(function (g) {
      var n = { planned: 0, progress: 0, done: 0 }, demos = 0, demosDone = 0;
      tasks.forEach(function (t) {
        if (!g[1](data.rows[t.row])) return;
        n[eff(t)]++;
        if (t.demo) { demos++; if (t.demoDone) demosDone++; }
      });
      return card(g[0], n, demosDone + '/' + demos + ' demos complete');
    }).join('');
    ps.innerHTML = html;
    var all = { planned: 0, progress: 0, done: 0 };
    tasks.forEach(function (t) { all[eff(t)]++; });
    var gl = document.getElementById('gl-tasks');
    if (gl) gl.innerHTML = '<b>' + all.done + ' of ' + (all.planned + all.progress + all.done) + '</b> innovation tasks done, ' + all.progress + ' in progress';
  }

  var KINDTXT = { implementation: 'initial implementation', interface: 'shared through a new interface',
                  shared: 'shared as a module', available: 'already available' };
  function taskCells(task) {
    return [task.mfc].concat(task.software).filter(function (c) { return colIndex[c] !== undefined; })
      .map(function (c) { return task.row + '|' + colIndex[c]; });
  }
  function describe(task) {
    var st = eff(task);
    var s = '<strong>' + task.innovation + '</strong> &middot; ' + task.mfc +
            (task.software.length ? ' with ' + task.software.join(', ') : '') +
            ' (' + (KINDTXT[task.kind] || task.kind) + (task.iface ? ', via ' + task.iface : '') +
            (task.source ? ', method from ' + task.source : '') + '): ';
    if (task.demo && st === 'planned' && !task.demoDone) s += '<strong>Planned demonstration</strong>';
    else if (!task.demo && st === 'planned') s = s.replace(/: $/, '');   // no demonstration: no status to report yet
    else {
      s += '<strong>' + STATUS[st] + '</strong>';
      if (task.demo) s += task.demoDone ? ', demonstration complete' : ', demonstration to come';
    }
    if (task.iface && task.status !== 'via' && ifStatus(task.iface) !== 'planned') s += '; interface ' + STATUS[ifStatus(task.iface)].toLowerCase();
    if (task.note) s += '. ' + task.note.replace(/</g, '&lt;');
    return s + '.';
  }

  // Selecting a cell highlights every cell of its task(s): the MFC and the DA software it uses.
  if (table) table.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-r]');
    if (!b) return;
    var ri = +b.dataset.r, ci = +b.dataset.c, r = data.rows[ri], code = r.cells[ci];
    table.querySelectorAll('td.sel, td.src').forEach(function (td) { td.classList.remove('sel', 'src'); });
    var list = byCell[ri + '|' + ci] || [];
    list.forEach(function (t) {
      if (!t.source || colIndex[t.source] === undefined) return;
      var sb = table.querySelector('button[data-r="' + t.row + '"][data-c="' + colIndex[t.source] + '"]');
      if (sb) sb.parentNode.classList.add('src');
    });
    var keys = [ri + '|' + ci];
    list.forEach(function (t) { keys = keys.concat(taskCells(t)); });
    var iface = code[0] === 'Y' && list.length ? list[0].iface : '';
    if (iface) {
      tasks.forEach(function (t) {
        if (t.iface !== iface) return;
        taskCells(t).forEach(function (k) {
          var p = k.split('|');
          if (data.rows[+p[0]].cells[+p[1]][0] === 'Y') keys.push(k);
        });
      });
    }
    keys.forEach(function (k) {
      var p = k.split('|');
      var btn = table.querySelector('button[data-r="' + p[0] + '"][data-c="' + p[1] + '"]');
      if (btn) btn.parentNode.classList.add('sel');
    });
    if (list.length) {
      var head = '';
      if (iface) {
        var n = tasks.filter(function (t) { return t.iface === iface; }).length;
        head = '<strong>' + iface + '</strong>: <strong>' + STATUS[ifStatus(iface)] + '</strong>, used by ' + n + (n === 1 ? ' task' : ' tasks') +
               (ifaceNote[iface] ? ' (' + ifaceNote[iface].replace(/</g, '&lt;') + ')' : '') + '.<br>';
      }
      detail.innerHTML = head + list.map(describe).join('<br>');
    } else {
      if (code === '-') { detail.innerHTML = '<strong>' + r.name + '</strong> in <strong>' + data.cols[ci] + '</strong>: not a planned activity.'; return; }
      var what = code[0] === 'B' ? 'already available before COMEDI'
               : code[0] === 'L' ? (rowReady(ri) ? 'available through sharing' : 'will be available through sharing once the initial implementation is done')
               : KIND[code[0]].toLowerCase();
      detail.innerHTML = '<strong>' + r.name + '</strong> in <strong>' + data.cols[ci] + '</strong>: ' + what + '. Not a COMEDI task.';
    }
  });

  render();
  fetch('data/interfaces.csv', { cache: 'no-store' }).then(function (res) {
    return res.ok ? res.text() : '';
  }).catch(function () { return ''; }).then(function (txt) {
    if (txt) parseCSV(txt).forEach(function (r) { ifaceStatus[r.interface] = normStatus(r.status); ifaceNote[r.interface] = r.note || ''; });
    return fetch('data/progress.csv', { cache: 'no-store' });
  }).then(function (res) {
    if (!res.ok) throw new Error(res.status);
    var lm = res.headers.get('Last-Modified');
    return res.text().then(function (txt) { return { txt: txt, lm: lm }; });
  }).then(function (o) {
    load(parseCSV(o.txt));
    loaded = true;
    render();
    if (!document.getElementById('p-updated')) return;
    document.getElementById('p-updated').textContent = tasks.length + ' tasks from progress.csv' +
      (o.lm ? ', last updated ' + new Date(o.lm).toISOString().slice(0, 10) : '') + '.';
  }).catch(function () {
    var upd = document.getElementById('p-updated');
    if (upd) upd.textContent = 'The task list (progress.csv) could not be loaded.';
  });
});
