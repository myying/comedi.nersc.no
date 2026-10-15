// Current project month: marks today on the work plan, and fills the home page's "Where we are" and
// "Latest news" cards from the work progress page and data/news (via entries.js), so those stay the single source.
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
  // The three newest news items, each with its picture or the COMEDI icon.
  Entries.list('news', 3).then(function (items) {
    document.getElementById('gl-news').innerHTML = items.map(function (e) {
      var img = e.img ? '<img src="' + e.img + '" alt="' + e.alt.replace(/"/g, '&quot;') + '">'
                      : '<img class="ph" src="assets/img/COMEDI.icon.svg" alt="">';
      var title = document.createElement('span');
      title.innerHTML = e.title;   // card heading as plain text
      return '<article class="gl-item">' + img + '<div><time datetime="' + e.date + '">' + e.nice + '</time>' +
        '<h3>' + title.textContent.replace(/</g, '&lt;') + '</h3><p>' + e.summary + '</p><a class="gl-read" href="' + e.url + '">Read more</a></div></article>';
    }).join('');
  }).catch(function () {});
})();
