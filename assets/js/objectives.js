// Objectives page: the wheel is a table of contents for the four boxes beside it
// (segments link to the boxes); scrolling the page highlights the segment of the box in view.
(function () {
  var wheel = document.querySelector('#obj-stage .wheel');
  var segs = wheel.querySelectorAll('.seg');
  var boxes = document.querySelectorAll('.detail');
  var current = -1;

  // the box whose top has passed 40% of the window; 0 = still above the first box
  function spy() {
    var n = 0, line = window.innerHeight * 0.4;
    boxes.forEach(function (b, i) { if (b.getBoundingClientRect().top < line) n = i + 1; });
    if (n === current) return;
    current = n;
    wheel.classList.toggle('has-active', n > 0);
    segs.forEach(function (s) { s.classList.toggle('active', +s.dataset.obj === n); });
  }

  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);
  spy();
})();
