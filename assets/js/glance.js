// Current project month: marks today on the work plan, and fills the home page's "Where we are" card
// (month, and the work packages active now). Runs in the browser because it changes with the date.
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

  // [WP, start month, end month] from the work plan, written by compile.py
  var active = JSON.parse(document.getElementById('wp-months').textContent)
    .filter(function (w) { return w[1] <= m && m <= w[2]; }).map(function (w) { return w[0]; });
  if (active.length) document.getElementById('gl-wps').innerHTML = 'Active now: <b>' + active.join(', ') + '</b>';
})();
