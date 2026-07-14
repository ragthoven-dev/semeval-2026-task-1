# MWAHAHA Subtask A Viewer

Minimal Streamlit viewer for side-by-side run comparison (sample-by-sample).

## Run

```bash
uv run streamlit run viewer/app.py
```

## How it works

- Scans `experiments/*/outputs/**/*.tsv` on load to build the run list.
- Filters by language (EN/ES/ZH) and lets you compare multiple runs (4 across is typical).
- Sample-by-sample navigation with Prev/Next and search on `id`/`headline`.
- Click **Refresh runs** if new outputs are added while the app is open.

## Notes

- The viewer recomputes the run list on load; no manifest is stored.
