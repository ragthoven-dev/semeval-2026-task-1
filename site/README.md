# RAGthoven website

Public site: <https://ragthoven-dev.github.io/semeval-2026-task-1/>

The website combines the Slovak headline showcase, the joke retrieval corpus,
the humor-mechanism reference catalog, and recorded planner/writer examples.
Visitors can prepare a four-stage prompt pack for their own headlines and
download input files. Prompt preparation runs in the browser; model inference
is performed separately with the visitor's chosen model or the repository's
pipeline.

## Preview locally

From the repository root:

```bash
python3 scripts/build_site_data.py
python3 scripts/check_site.py
python3 -m http.server 8000 --directory site
```

Open <http://localhost:8000/>. Hash-based navigation also works under the
GitHub Pages project path. No package installation, model credentials, or
submodule checkout is needed to run the website.

## Content and provenance

- `data/catalog.json` is the curated public snapshot of the completed Slovak
  showcase and its recorded retrieval/prompt examples.
- The data builder refreshes the 98-joke corpus from
  `data/jokes/joke_summaries.tsv` and the 16-technique reference catalog from
  `experiments/mwahaha_exp05_subtaskA/mechanisms.yaml`.
- Downloadable CSV/TSV files live in `downloads/`. Original source links are
  retained on joke records.
- The 16-technique reference catalog belongs to the earlier experiments.
  The active exp09 run instead receives mechanism labels from retrieved
  jokes; its planner and writer may narrow or summarize that inspiration.
- The September 2026 Slovak showcase is a demonstration, separate from the
  official EN/ES/ZH benchmark submission. Recorded prompts establish what was
  supplied to the stages, rather than attributing a final punchline to an
  individual source example.

Only the `site/` directory is deployed. Credentials, local run metadata,
internal model endpoints, and full generation traces are not published.

## Update and deploy

Edit the website or curated snapshot, then run:

```bash
python3 scripts/build_site_data.py
python3 scripts/check_site.py
node --check --input-type=module < site/app.js
node --test tests/prompt-builder.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

The `Website` GitHub Actions workflow checks pull requests and deploys
changes on `main` to the `github-pages` environment. A manual workflow run
can redeploy the current version. GitHub Pages must use **GitHub Actions**
as its publishing source.
