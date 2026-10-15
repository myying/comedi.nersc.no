// News items and project outputs, read in the browser from their source folders:
//   data/<section>/list.txt                     one folder name per line
//   data/<section>/<date>-<name>/article.html   <h1> title, first <p> summary, first <img> thumbnail, then any HTML
// Fills every list marked data-entries="<section>" (news.html, outputs.html, the home page's news card; optional
// data-max = number of entries, data-chars = length of the text preview, data-order="oldest" = oldest first,
// data-empty = text shown while there are no entries) and the article page (#article).
var Entries = (function () {
  var MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
  var FOLDER = /^(\d{4}(?:-\d{2}){0,2})-[\w.-]+$/;   // <date>-<name>, date = YYYY, YYYY-MM or YYYY-MM-DD
  var SECTIONS = { news: ['news.html', 'All news &amp; events'], outputs: ['outputs.html', 'All project outputs'] };

  function niceDate(d) {
    var p = d.split('-');
    if (p.length === 1) return p[0];
    var s = MONTHS[+p[1] - 1] + ' ' + p[0];
    return p.length > 2 ? +p[2] + ' ' + s : s;
  }
  function text(url) {
    // no-cache: always revalidate, so a new or edited entry shows up at once
    return fetch(url, { cache: 'no-cache' }).then(function (res) { if (!res.ok) throw new Error(url + ': ' + res.status); return res.text(); });
  }
  function attr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  // One entry, with the article's relative links and images pointing into its folder.
  function load(section, slug) {
    var m = FOLDER.exec(slug);
    if (!SECTIONS[section] || !m) return Promise.reject(new Error('not an entry: ' + section + '/' + slug));
    var dir = new URL('data/' + section + '/' + slug + '/', location.href);
    return text(new URL('article.html', dir)).then(function (src) {
      var body = new DOMParser().parseFromString(src, 'text/html').body;
      body.querySelectorAll('[src], [href]').forEach(function (el) {
        var at = el.hasAttribute('src') ? 'src' : 'href';
        if (el.getAttribute(at).charAt(0) !== '#') el.setAttribute(at, new URL(el.getAttribute(at), dir).href);
      });
      var h1 = body.querySelector('h1');
      return {
        section: section, slug: slug, date: m[1], nice: niceDate(m[1]),
        url: 'article.html?' + section + '/' + slug, title: h1 ? h1.innerHTML : slug, body: body
      };
    });
  }

  // Entries of a section, newest first; max limits how many articles are fetched.
  function list(section, max) {
    return text('data/' + section + '/list.txt').then(function (txt) {
      var slugs = txt.split('\n').map(function (l) { return l.trim(); })
        .filter(function (l) { return l && l.charAt(0) !== '#'; })
        .sort(function (a, b) {
          var da = (FOLDER.exec(a) || [, ''])[1], db = (FOLDER.exec(b) || [, ''])[1];
          return da < db ? 1 : da > db ? -1 : 0;
        });
      if (max) slugs = slugs.slice(0, max);
      return Promise.all(slugs.map(function (s) {
        return load(section, s).catch(function (err) { console.warn(err); return null; });
      }));
    }).then(function (all) { return all.filter(Boolean); });
  }

  var PICS = 4;   // pictures shown next to an entry in the lists

  // The article's paragraphs up to about `chars` characters; more = the article has anything the preview leaves out.
  function preview(body, chars) {
    var out = [], used = 0, more = false;
    body.querySelectorAll('p').forEach(function (p) {
      var t = p.textContent.replace(/\s+/g, ' ').trim();
      if (!t) return;
      if (chars - used < 80) { more = true; used = chars; return; }   // too little room left: don't start a paragraph just to cut it
      if (used + t.length <= chars) { out.push(p.innerHTML); used += t.length; return; }
      var cut = t.slice(0, chars - used);
      out.push(attr(cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)) + '&hellip;');
      used = chars; more = true;
    });
    if (body.querySelectorAll('img').length > PICS || body.querySelector('ul, ol, table, figure, blockquote, h2, h3, h4, video, iframe'))
      more = true;
    return { html: out.map(function (h) { return '<p>' + h + '</p>'; }).join(''), more: more };
  }

  function entryHTML(e, chars) {
    var imgs = Array.prototype.slice.call(e.body.querySelectorAll('img')), pv = preview(e.body, chars);
    var shown = imgs.slice(0, PICS), extra = imgs.length - shown.length;
    var pics = shown.map(function (img, i) {
      var tag = '<img src="' + attr(img.getAttribute('src')) + '" alt="' + attr(img.alt) + '" loading="lazy">';
      return extra && i === shown.length - 1 ? '<div class="more">' + tag + '<span>+' + extra + '</span></div>' : tag;
    }).join('');
    var title = pv.more ? '<a href="' + e.url + '">' + e.title + '</a>' : e.title;
    return '<li id="' + e.slug + '"' + (shown.length ? ' class="has-pics"' : '') + '><div>' +
      '<time datetime="' + e.date + '">' + e.nice + '</time><h3>' + title + '</h3>' + pv.html +
      (pv.more ? '<a class="read-more" href="' + e.url + '">Read more</a>' : '') + '</div>' +
      (shown.length ? '<div class="entry-pics n' + shown.length + '">' + pics + '</div>' : '') + '</li>';
  }

  function renderList(box) {
    var max = +box.getAttribute('data-max') || 0, chars = +box.getAttribute('data-chars') || 400;
    list(box.getAttribute('data-entries'), max).then(function (items) {
      if (box.getAttribute('data-order') === 'oldest') items.reverse();
      box.innerHTML = items.length ? items.map(function (e) { return entryHTML(e, chars); }).join('')
        : '<li class="empty">' + attr(box.getAttribute('data-empty') || '') + '</li>';
    }).catch(function (err) { console.warn(err); });
  }

  // article.html?<section>/<folder>
  function renderArticle(box) {
    var q = location.search.slice(1).split('/'), sec = SECTIONS[q[0]];
    if (sec) {
      var nav = document.querySelector('#nav-links a[href="' + sec[0] + '"]');
      if (nav) nav.setAttribute('aria-current', 'page');
    }
    load(q[0], q[1]).then(function (e) {
      var h = e.body.querySelector('h1');
      if (h) h.outerHTML = '<h2>' + h.innerHTML + '</h2>';   // page headings are h2 across the site
      document.title = (h ? e.body.querySelector('h2').textContent : e.slug) + ' | COMEDI';
      box.innerHTML = '<p class="back"><a href="' + sec[0] + '">&larr; ' + sec[1] + '</a></p>' +
        '<time datetime="' + e.date + '">' + e.nice + '</time>' + e.body.innerHTML;
    }).catch(function (err) {
      console.warn(err);
      box.innerHTML = '<h2>Not found</h2><p>This article does not exist. <a href="' + (sec ? sec[0] : 'news.html') + '">See all entries</a>.</p>';
    });
  }

  document.querySelectorAll('[data-entries]').forEach(renderList);
  var art = document.getElementById('article');
  if (art) renderArticle(art);

  return { list: list };
})();
