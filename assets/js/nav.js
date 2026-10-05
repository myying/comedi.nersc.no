(function () {
  var nav = document.getElementById('site-nav');
  var list = document.getElementById('nav-links');
  var toggle = nav.querySelector('.nav-toggle');
  var hero = document.getElementById('top');
  var links = Array.prototype.slice.call(list.querySelectorAll('a'));

  // old one-page anchors (index.html#about, #objective-2, #outcomes, #partners) now live on their own pages
  var old = location.hash.slice(1).replace('outcomes', 'outputs').replace('partners', 'about');
  if (hero && old) {
    var obj = /^objective-[1-4]$/.test(old);
    if (obj || links.some(function (a) { return a.getAttribute('href') === old + '.html'; })) {
      location.replace(obj ? 'objectives.html#' + old : old + '.html');
      return;
    }
  }

  var page = location.pathname.split('/').pop() || 'index.html';
  links.forEach(function (a) { if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page'); });

  function setOpen(open) {
    list.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  toggle.addEventListener('click', function () { setOpen(!list.classList.contains('open')); });
  links.forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
})();
