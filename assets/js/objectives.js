(function () {
  var wheel = document.querySelector('#obj-stage .wheel');
  var panel = document.getElementById('obj-panel');
  var views = panel.querySelectorAll('[data-view]');
  var segs = wheel.querySelectorAll('.seg');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 0;

  function show(n, origin, animate) {
    if (n === current && n !== 0) n = 0;   // clicking the open objective closes it
    current = n;
    wheel.classList.toggle('has-active', n > 0);
    segs.forEach(function (s) {
      var on = +s.dataset.obj === n;
      s.classList.toggle('active', on);
      s.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    views.forEach(function (v) { v.hidden = v.dataset.view !== String(n); });
    panel.style.setProperty('--oc', n ? 'var(--o' + n + ')' : 'transparent');
    panel.classList.toggle('tinted', n > 0);

    if (animate && n > 0 && !reduce) {
      // colour floods out of the chosen segment and settles into the panel
      var src = origin || wheel.querySelector('.seg[data-obj="' + n + '"] .seg-fill');
      var pr = panel.getBoundingClientRect(), sr = src.getBoundingClientRect();
      var x = sr.left + sr.width / 2 - pr.left, y = sr.top + sr.height / 2 - pr.top;
      var r = Math.max(Math.hypot(x, y), Math.hypot(pr.width - x, y),
                       Math.hypot(x, pr.height - y), Math.hypot(pr.width - x, pr.height - y));
      panel.style.setProperty('--x', x + 'px');
      panel.style.setProperty('--y', y + 'px');
      panel.style.setProperty('--r', r + 'px');
      panel.classList.remove('flooding');
      void panel.offsetWidth;
      panel.classList.add('flooding');
    }
    if (animate && (pr = panel.getBoundingClientRect()) && (pr.top < 0 || pr.top > window.innerHeight * 0.6)) {
      panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    try {
      history.replaceState(null, '', n ? '#objective-' + n : location.pathname + location.search);
    } catch (e) {}
  }

  segs.forEach(function (s) {
    s.addEventListener('click', function () { show(+s.dataset.obj, s.querySelector('.seg-fill'), true); });
    s.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(+s.dataset.obj, s.querySelector('.seg-fill'), true); }
    });
  });
  panel.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (!b) return;
    var n = +b.dataset.open;
    if (n === current) return;
    show(n, n ? wheel.querySelector('.seg[data-obj="' + n + '"] .seg-fill') : null, true);
  });

  var m = /^#objective-([1-4])$/.exec(location.hash);
  if (m) { show(+m[1], null, false); panel.scrollIntoView({ behavior: 'instant', block: 'start' }); }
  window.addEventListener('hashchange', function () {
    var h = /^#objective-([1-4])$/.exec(location.hash);
    if (!h) return;
    current = 0;
    show(+h[1], null, true);
    panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
})();
