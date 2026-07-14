# Data

This directory holds the data used by the experiments.

## Included

- `jokes/joke_summaries.tsv` — the 98-entry joke retrieval corpus used by the
  RAG-augmented Planner (Exp08+). Columns: `id`, `joke`, `summary`,
  `mechanism`, `topic`, `source`. This corpus is original to this work and is
  released here for reproducibility.

## Not included: official task data (`trial/`, `test/`)

The experiment configs reference the official SemEval-2026 Task 1 (MWAHAHA)
Subtask A inputs at:

- `data/trial/task-a-{en,es,zh}.tsv`
- `data/test/task-a-{en,es,zh}.tsv`

These files are **provided by the shared-task organizers** (news headlines and
constraint word pairs) and are **not redistributed here**. Download them from
the official task resources and place them under `data/trial/` and `data/test/`
so the config paths resolve:

- Task website: https://pln-fing-udelar.github.io/semeval-2026-humor-gen/
- Competition (Codabench): https://www.codabench.org/competitions/9719/
- Organizer repository: https://github.com/pln-fing-udelar/semeval-2026-humor-gen

Each input TSV has columns `id`, `word1`, `word2`, `headline` (absent fields are
marked `-`). The small `experiments/mwahaha_exp09_subtaskA/data/` and
`experiments/mwahaha_exp10_subtaskA/data/` 12-row samples are derived from the
English trial split and are included so the agentic experiments run without the
full download.
