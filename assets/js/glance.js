// Current project month: marks today on the work plan, and fills the home page's "Where we are" and
// card from the work progress page, so that page stays the single source. (Latest news: entries.js.)
(function () {
  var now = new Date();
  // M1 = September 2026
  var m = (now.getFullYear() - 2026) * 12 + (now.getMonth() - 8) + 1;
  if (m < 1) m = 1;
  if (m > 48) m = 48;

  var gantt = document.querySelector('.gantt');
  if (gantt) gantt.style.setProperty('--today', m);
  if (!document.getElementById('gl-month')) return;

  document.getElementById('gl-month').textContent = m;
  document.getElementById('gl-time').style.setProperty('--p', (100 * m / 48) + '%');

  function page(url) {
    return fetch(url).then(function (res) { return res.text(); })
      .then(function (txt) { return new DOMParser().parseFromString(txt, 'text/html'); });
  }
  page('workprogress.html').then(function (doc) {
    var active = [];
    doc.querySelectorAll('.gantt .g-row:not(.g-head)').forEach(function (row) {
      var bar = row.querySelector('.g-bar');
      var st = +bar.style.getPropertyValue('--s'), en = +bar.style.getPropertyValue('--e');
      if (st <= m && m <= en) active.push(row.querySelector('.g-label b').textContent);
    });
    if (active.length) document.getElementById('gl-wps').innerHTML = 'Active now: <b>' + active.join(', ') + '</b>';
  }).catch(function () {});
})();
