#!/usr/bin/env python3
"""Compile data/ into the pages, so visitors get finished HTML with nothing left to fetch.

  ./compile.py   rebuild; prints the files it changed (the pre-commit hook stages them)

Fills the regions between <!-- build:NAME --> and <!-- /build:NAME --> in the pages, and the data in their
<script type="application/json" id=...> blocks:
  news.html, outputs.html   every entry of data/news, data/outputs (see README)
  index.html                the three newest news items, the innovation task count, the work package months
  workprogress.html         the innovation table and its summary, from data/innovations.json,
                            data/progress.csv and data/interfaces.csv
and writes one page per entry, news/<folder>.html and outputs/<folder>.html.
"""
import csv, html, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()
FOLDER = re.compile(r'^(\d{4}(?:-\d{2}){0,2})-[\w.-]+$')   # <date>-<name>, date = YYYY, YYYY-MM or YYYY-MM-DD
SECTIONS = {'news': ('news.html', 'All news &amp; events'), 'outputs': ('outputs.html', 'All project outputs')}
PICS = 4   # pictures shown next to an entry in the lists
changed = []


def esc(s):
    return html.escape(str(s))


def text_of(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', h))).strip()


def fill(page, name, content):
    pat = re.compile(r'(<!-- build:%s -->).*?(<!-- /build:%s -->)' % (name, name), re.S)
    if not pat.search(page):
        sys.exit('compile.py: no <!-- build:%s --> region' % name)
    return pat.sub(lambda m: m[1] + content + m[2], page)


def fill_json(page, id, value):
    """Data for a page's script, in <script type="application/json" id="ID"></script>."""
    pat = re.compile(r'(<script type="application/json" id="%s">).*?(</script>)' % id, re.S)
    if not pat.search(page):
        sys.exit('compile.py: no <script type="application/json" id="%s">' % id)
    data = json.dumps(value, separators=(',', ':')).replace('</', '<\\/')
    return pat.sub(lambda m: m[1] + data + m[2], page)


def write(path, text):
    path = ROOT / path
    if not path.exists() or path.read_text() != text:
        path.parent.mkdir(exist_ok=True)
        path.write_text(text)
        changed.append(str(path.relative_to(ROOT)))


def relink(page, prefix):
    """Point the relative links and images of a page at `prefix` (for pages one folder down)."""
    return re.sub(r'\b(src|href)="(?![a-z][a-z0-9+.-]*:|#|/)', r'\1="' + prefix, page)


# ---- news and outputs ----

def entries(section):
    lines = (ROOT / 'data' / section / 'list.txt').read_text().splitlines()
    out = []
    for slug in [l.strip() for l in lines if l.strip() and not l.strip().startswith('#')]:
        m = FOLDER.match(slug)
        if not m:
            sys.exit('compile.py: data/%s/%s: folder name must be <date>-<name>' % (section, slug))
        src = (ROOT / 'data' / section / slug / 'article.html').read_text()
        src = relink(src, 'data/%s/%s/' % (section, slug))   # the article's own files, from the site root
        p = m[1].split('-')
        nice = p[0] if len(p) == 1 else ((str(int(p[2])) + ' ') if len(p) > 2 else '') + MONTHS[int(p[1]) - 1] + ' ' + p[0]
        h1 = re.search(r'<h1\b[^>]*>(.*?)</h1>', src, re.S)
        out.append(dict(section=section, slug=slug, date=m[1], nice=nice, src=src.strip(),
                        url='%s/%s.html' % (section, slug), title=h1[1].strip() if h1 else slug))
    return sorted(out, key=lambda e: e['date'], reverse=True)


# ponytail: articles are parsed with regexes, which is enough for the plain <h1>/<p>/<img> HTML the README
# asks for; switch to html.parser if articles start nesting paragraphs or putting '>' inside attributes.
def preview(src, chars):
    """The article's paragraphs up to about `chars` characters; more = the article has anything left out."""
    out, used, more = [], 0, False
    for inner in re.findall(r'<p\b[^>]*>(.*?)</p>', src, re.S):
        t = text_of(inner)
        if not t:
            continue
        if chars - used < 80:   # too little room left: don't start a paragraph just to cut it
            more, used = True, chars
            continue
        if used + len(t) <= chars:
            out.append(inner.strip())
            used += len(t)
            continue
        cut = t[:chars - used]
        out.append(esc(cut[:cut.rfind(' ')] if cut.rfind(' ') > 0 else cut) + '&hellip;')
        used, more = chars, True
    if len(re.findall(r'<img\b', src)) > PICS or re.search(r'<(ul|ol|table|figure|blockquote|h2|h3|h4|video|iframe)\b', src):
        more = True
    return ''.join('<p>%s</p>' % h for h in out), more


def attr(tag, name):
    m = re.search(r'\b%s="([^"]*)"' % name, tag)
    return html.unescape(m[1]) if m else ''


def entry_html(e, chars):
    imgs = re.findall(r'<img\b[^>]*>', e['src'])
    pv, more = preview(e['src'], chars)
    shown, extra = imgs[:PICS], len(imgs) - len(imgs[:PICS])
    pics = ''
    for i, img in enumerate(shown):
        tag = '<img src="%s" alt="%s" loading="lazy">' % (esc(attr(img, 'src')), esc(attr(img, 'alt')))
        pics += '<div class="more">%s<span>+%d</span></div>' % (tag, extra) if extra and i == len(shown) - 1 else tag
    title = '<a href="%s">%s</a>' % (e['url'], e['title']) if more else e['title']
    return ('<li id="%s"%s><div><time datetime="%s">%s</time><h3>%s</h3>%s%s</div>%s</li>' % (
        e['slug'], ' class="has-pics"' if shown else '', e['date'], e['nice'], title, pv,
        '<a class="read-more" href="%s">Read more</a>' % e['url'] if more else '',
        '<div class="entry-pics n%d">%s</div>' % (len(shown), pics) if shown else ''))


def entry_list(items, chars, empty=''):
    if not items:
        return '<li class="empty">%s</li>' % esc(empty)
    return ''.join(entry_html(e, chars) for e in items)


def article_page(e, template):
    """news/<folder>.html: the section page with the article in place of the list."""
    page_url, back = SECTIONS[e['section']]
    body = re.sub(r'<h1\b[^>]*>(.*?)</h1>', r'<h2>\1</h2>', e['src'], count=1, flags=re.S)   # page headings are h2
    summary = re.search(r'<p\b[^>]*>(.*?)</p>', e['src'], re.S)
    page = fill(template, 'page', '\n    <article class="article" id="article"><p class="back"><a href="%s">&larr; %s</a></p>'
                '<time datetime="%s">%s</time>%s</article>\n    ' % (page_url, back, e['date'], e['nice'], body))
    page = re.sub(r'<title>.*?</title>', '<title>%s | COMEDI</title>' % esc(text_of(e['title'])), page)
    if summary:
        page = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m[1] + esc(text_of(summary[1])), page)
    page = page.replace('<a href="%s">' % page_url, '<a href="%s" aria-current="page">' % page_url, 1)
    return relink(page, '../')


# ---- innovation progress (work progress page, home page task count) ----

KIND = {'D': 'Initial implementation', 'L': 'Shared as a module', 'Y': 'Shared through a new interface', 'B': 'Already available'}
STATUS = {'planned': 'Planned', 'progress': 'In progress', 'done': 'Done'}
KINDTXT = {'implementation': 'initial implementation', 'interface': 'shared through a new interface',
           'shared': 'shared as a module', 'available': 'already available'}


def norm_status(s):
    s = (s or 'planned').lower()
    if s in ('finished', 'complete', 'completed'):
        return 'done'
    if s in ('in progress', 'ongoing'):
        return 'progress'
    if s.startswith('via'):
        return 'via'   # follows its interface's status in interfaces.csv
    return s if s in STATUS else 'planned'


def read_csv(name):
    with open(ROOT / 'data' / name, newline='') as f:
        return [{k.strip().lower(): (v or '').strip() for k, v in r.items()} for r in csv.DictReader(f)]


def progress():
    data = json.loads((ROOT / 'data' / 'innovations.json').read_text())
    rows, cols, split = data['rows'], data['cols'], data['split']
    row_ix = {r['name']: i for i, r in enumerate(rows)}
    col_ix = {c: i for i, c in enumerate(cols)}
    iface_status, iface_note = {}, {}
    for r in read_csv('interfaces.csv'):
        s = norm_status(r.get('status'))
        iface_status[r['interface']] = 'planned' if s == 'via' else s
        iface_note[r['interface']] = r.get('note', '')
    tasks, by_cell = [], {}
    for t in read_csv('progress.csv'):
        ri = row_ix.get(t['innovation'])
        if ri is None:
            continue
        task = dict(innovation=t['innovation'], row=ri, mfc=t.get('mfc', ''),
                    software=[s.strip() for s in t.get('software', '').split(';') if s.strip()],
                    kind=t.get('kind', '').lower(), iface=t.get('interface', ''), source=t.get('source', ''),
                    status=norm_status(t.get('status')), demo=t.get('demo', '').lower().startswith('y'),
                    demo_done=t.get('demo_done', '').lower().startswith('y'), note=t.get('note', ''))
        tasks.append(task)
        for c in [task['mfc']] + task['software']:
            if c in col_ix:
                by_cell.setdefault((ri, col_ix[c]), []).append(task)

    def if_status(name): return iface_status.get(name, 'planned')
    def eff(t): return if_status(t['iface']) if t['status'] == 'via' else t['status']
    # yellow cells always show the state of the interface they rely on
    def cell_task_status(t, code): return if_status(t['iface']) if code[0] == 'Y' and t['iface'] else eff(t)
    # a row's tool becomes available to others once one of its initial implementations is done
    def row_ready(ri): return any(t['row'] == ri and t['kind'] == 'implementation' and eff(t) == 'done' for t in tasks)
    def task_cells(t): return ['%d|%d' % (t['row'], col_ix[c]) for c in [t['mfc']] + t['software'] if c in col_ix]

    def cell_status(lst, code):
        s = [cell_task_status(t, code) for t in lst]
        if all(x == 'done' for x in s):
            return 'done'
        return 'progress' if any(x != 'planned' for x in s) else 'planned'

    def describe(t):
        st = eff(t)
        s = '<strong>%s</strong> &middot; %s%s (%s%s%s): ' % (
            t['innovation'], t['mfc'], ' with ' + ', '.join(t['software']) if t['software'] else '',
            KINDTXT.get(t['kind'], t['kind']), ', via ' + t['iface'] if t['iface'] else '',
            ', method from ' + t['source'] if t['source'] else '')
        if t['demo'] and st == 'planned' and not t['demo_done']:
            s += '<strong>Planned demonstration</strong>'
        elif not t['demo'] and st == 'planned':
            s = s[:-2]   # no demonstration: no status to report yet
        else:
            s += '<strong>%s</strong>' % STATUS[st]
            if t['demo']:
                s += ', demonstration complete' if t['demo_done'] else ', demonstration to come'
        if t['iface'] and t['status'] != 'via' and if_status(t['iface']) != 'planned':
            s += '; interface ' + STATUS[if_status(t['iface'])].lower()
        if t['note']:
            s += '. ' + t['note'].replace('<', '&lt;')
        return s + '.'

    # the table; each cell's click result (cells to highlight, method sources, description) goes to progress.js
    h = ('<thead><tr class="grp"><th></th><th colspan="%d">MFC</th><th class="sep"></th><th colspan="%d">DA software</th></tr><tr><th></th>'
         % (split, len(cols) - split))
    for i, c in enumerate(cols):
        h += ('<th class="sep"></th>' if i == split else '') + '<th class="vert" scope="col">%s</th>' % c
    h += '</tr></thead><tbody>'
    clicks, last_group = {}, ''
    for ri, r in enumerate(rows):
        if r['group'] != last_group:
            h += '<tr><th class="path" colspan="%d">%s</th></tr>' % (len(cols) + 2, r['group'])
            last_group = r['group']
        h += '<tr><th class="row" scope="row">%s</th>' % r['name']
        for ci, code in enumerate(r['cells']):
            if ci == split:
                h += '<td class="sep"></td>'
            lst = by_cell.get((ri, ci), [])
            key = '%d|%d' % (ri, ci)
            src = ['%d|%d' % (t['row'], col_ix[t['source']]) for t in lst if t['source'] in col_ix]
            sel = [key] + [k for t in lst for k in task_cells(t)]
            iface = lst[0]['iface'] if code[0] == 'Y' and lst else ''
            if iface:
                sel += [k for t in tasks if t['iface'] == iface for k in task_cells(t)
                        if rows[int(k.split('|')[0])]['cells'][int(k.split('|')[1])][0] == 'Y']
            if lst:
                head = ''
                if iface:
                    n = sum(t['iface'] == iface for t in tasks)
                    head = '<strong>%s</strong>: <strong>%s</strong>, used by %d %s%s.<br>' % (
                        iface, STATUS[if_status(iface)], n, 'task' if n == 1 else 'tasks',
                        ' (%s)' % iface_note[iface].replace('<', '&lt;') if iface_note.get(iface) else '')
                detail = head + '<br>'.join(describe(t) for t in lst)
            elif code == '-':
                detail = '<strong>%s</strong> in <strong>%s</strong>: not a planned activity.' % (r['name'], cols[ci])
            else:
                what = ('already available before COMEDI' if code[0] == 'B' else
                        ('available through sharing' if row_ready(ri) else
                         'will be available through sharing once the initial implementation is done') if code[0] == 'L' else
                        KIND[code[0]].lower())
                detail = '<strong>%s</strong> in <strong>%s</strong>: %s. Not a COMEDI task.' % (r['name'], cols[ci], what)
            clicks[key] = [list(dict.fromkeys(sel)), src, detail]
            if code == '-':
                h += '<td class="e"><button type="button" data-r="%d" data-c="%d" aria-label="%s, %s: not a planned activity"></button></td>' % (
                    ri, ci, esc(r['name']), esc(cols[ci]))
                continue
            if code[0] == 'B':
                state = 'avail'                                   # capability that already exists
            elif lst:
                state = 'st-' + cell_status(lst, code)
            elif code[0] == 'L':
                state = 'avail' if row_ready(ri) else 'e'         # shared once the tool is built
            else:
                state = 'e'
            if state == 'st-planned':
                state = 'e'                                       # nothing is drawn until work starts
            demos = [t for t in lst if t['demo']]
            mark = '<b class="xk" aria-label="demonstration complete">X</b>' if demos and all(t['demo_done'] for t in demos) else ''
            h += '<td class="c-%s %s"><button type="button" data-r="%d" data-c="%d" aria-label="%s, %s">%s</button></td>' % (
                code[0], state, ri, ci, esc(r['name']), esc(cols[ci]), mark)
        h += '</tr>'
    table = h + '</tbody>'

    # one summary card per kind of task; interface tasks count under their kind
    obs = 'New observation operators'
    groups = [('Core methods', lambda r: r['path'] == 1), ('Modular tools', lambda r: r['path'] == 2 and r['group'] != obs),
              ('Observation operators', lambda r: r['group'] == obs), ('Model-specific', lambda r: r['path'] == 3)]
    cards = ''
    for label, test in groups:
        n, demos, demos_done = dict.fromkeys(STATUS, 0), 0, 0
        for t in tasks:
            if test(rows[t['row']]):
                n[eff(t)] += 1
                demos += t['demo']
                demos_done += t['demo'] and t['demo_done']
        total = sum(n.values())
        d = total or 1
        cards += ('<div class="p-sum"><div class="lbl">%s</div><div class="val">%d/%d<small>done &middot; %d in progress</small></div>'
                  '<div class="demo-line">%d/%d demos complete</div><div class="p-bar"><span class="b-done" style="width:%g%%"></span>'
                  '<span class="b-progress" style="width:%g%%"></span></div></div>') % (
            label, n['done'], total, n['progress'], demos_done, demos, 100 * n['done'] / d, 100 * n['progress'] / d)
    n = dict.fromkeys(STATUS, 0)
    for t in tasks:
        n[eff(t)] += 1
    count = '<b>%d of %d</b> innovation tasks done, %d in progress' % (n['done'], sum(n.values()), n['progress'])
    try:
        when = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', 'data/progress.csv'], cwd=ROOT,
                              capture_output=True, text=True).stdout.strip()
    except OSError:
        when = ''
    updated = '%d tasks from progress.csv%s.' % (len(tasks), ', last updated ' + when if when else '')
    return table, cards, count, updated, clicks


def main():
    news, outputs = entries('news'), entries('outputs')
    pages = {p: (ROOT / p).read_text() for p in ('index.html', 'news.html', 'outputs.html', 'workprogress.html')}
    table, cards, count, updated, clicks = progress()

    pages['news.html'] = fill(pages['news.html'], 'news', entry_list(news, 500))
    pages['outputs.html'] = fill(pages['outputs.html'], 'outputs',
                                 entry_list(outputs, 500, 'The first outputs will appear here once they are completed.'))
    pages['index.html'] = fill(pages['index.html'], 'news', entry_list(news[:3], 200))
    pages['index.html'] = fill(pages['index.html'], 'tasks', count)
    # work package months from the work plan, for glance.js to name the ones active this month
    wps = re.findall(r'<b>(WP\d+)</b>.*?--s:(\d+);--e:(\d+)', pages['workprogress.html'])
    pages['index.html'] = fill_json(pages['index.html'], 'wp-months', [[w, int(s), int(e)] for w, s, e in wps])
    pages['workprogress.html'] = fill(pages['workprogress.html'], 'table', table)
    pages['workprogress.html'] = fill(pages['workprogress.html'], 'summary', cards)
    pages['workprogress.html'] = fill(pages['workprogress.html'], 'updated', updated)
    pages['workprogress.html'] = fill_json(pages['workprogress.html'], 'p-cells', clicks)
    for p, text in pages.items():
        write(p, text)

    for section, items in (('news', news), ('outputs', outputs)):
        keep = set()
        for e in items:
            write(e['url'], article_page(e, pages[SECTIONS[section][0]]))
            keep.add(e['url'])
        for old in (ROOT / section).glob('*.html'):   # entries taken off the list
            if '%s/%s' % (section, old.name) not in keep:
                old.unlink()
                changed.append('%s/%s' % (section, old.name))
    if changed:
        print('\n'.join(changed))


if __name__ == '__main__':
    main()
