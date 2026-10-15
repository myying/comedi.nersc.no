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
3. Add the folder name as a new line in `data/news/list.txt` (or `data/outputs/list.txt`). The pages read the
   list in the browser and sort it by date: the news and outputs pages list every entry, the home page shows the
   three newest news items, and "Read more" opens `article.html?news/<folder>`.
4. Commit. To preview locally, run `python3 -m http.server` in the repo and open http://localhost:8000
   (opening the files directly does not work, the browser blocks reading the data files).
