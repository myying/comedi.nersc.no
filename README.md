# comedi.nersc.no

Static website of the COMEDI project. Plain HTML, CSS and JavaScript, no build step.

## Adding a news item or a project output

1. Create a folder `data/news/<date>-<shortname>/` (or `data/outputs/<date>-<shortname>/` for a deliverable).
   `<date>` is `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, e.g. `data/news/2026-11-05-kickoff/`.
2. Put the images (and any PDF) in that folder, and write `article.html` next to them:

   ```html
   <h1>Kick-off meeting in Bergen</h1>
   <p>Partners met at NERSC to plan the first year of work.</p>
   <img src="meeting.jpg" alt="Partners at the kick-off meeting">
   <p>The rest of the article, any HTML.</p>
   ```

   The `<h1>` is the title, the first `<p>` is the summary shown in the lists, and the first `<img>` (optional)
   is the thumbnail. Keep images to a sensible size (around 1600 px wide).
3. Add the folder name as a new line in `data/news/list.txt` (or `data/outputs/list.txt`), then commit.
   `compile.py` sorts the list by date and writes the entries into the pages: the news and outputs pages list
   every entry, the home page shows the three newest news items, and "Read more" opens `news/<folder>.html`.

## Compiling the pages

The pages are plain HTML that visitors get complete, with nothing fetched in the browser. `compile.py` (Python 3,
no extra packages) builds them from `data/`: the news and outputs lists and their article pages (`news/`,
`outputs/`), the home page's latest news and task count, and the work progress table and summary (from
`innovations.json`, `progress.csv`, `interfaces.csv`). It only rewrites the regions between
`<!-- build:NAME -->` and `<!-- /build:NAME -->`; edit everything else in the pages by hand as usual.

A pre-commit hook runs it and adds the compiled files to each commit. Enable it once per clone:

    git config core.hooksPath .githooks

Or run `./compile.py` yourself after changing `data/`. To preview, run `python3 -m http.server` in the repo and
open http://localhost:8000 (opening the files directly also works now).
