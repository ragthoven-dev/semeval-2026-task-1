# Experiment 01: MWAHAHA Subtask A (config-driven)

This is the **first experiment** in this repo. All assets live under
`experiments/mwahaha_exp01_subtaskA/` to keep future experiments separate.

## What it does
- Config-driven RAGThoven pipeline for Subtask A (text-only humor)
- Languages: EN / ES / ZH (run separately)
- Output: TSV with `id` + `text` columns
- Prompt-only safety/format enforcement (no post-processing)

## Inputs
Trial data (committed):
- `data/trial/task-a-en.tsv`
- `data/trial/task-a-es.tsv`
- `data/trial/task-a-zh.tsv`

Columns: `id`, `word1`, `word2`, `headline`
- If `word1` or `word2` is `-`, treat it as no constraint
- Otherwise both words must appear naturally in the joke

## Prompt assets
- Prompts live directly in `config/*.yaml` (`llm.prompts`); there are no separate template files.
- `mechanisms.yaml` is kept as a reference list (16 mechanisms, name/desc/ex1/ex2).

## Constraints (encoded in prompts)
- Non-offensive: no hate, slurs, harassment, stereotypes, violent or demeaning content, no mocking victims
- 1-3 sentences (prefer 1-2)
- Must clearly reference the headline
- Language follows headline
- Length caps: EN/ES <= 900 chars; ZH <= 300 chars
- Output must be plain text only (no labels/JSON/quotes)

## Run commands
EN:
```bash
ragthoven experiments/mwahaha_exp01_subtaskA/config/en.yaml --output tsv
```

ES:
```bash
ragthoven experiments/mwahaha_exp01_subtaskA/config/es.yaml --output tsv
```

ZH:
```bash
ragthoven experiments/mwahaha_exp01_subtaskA/config/zh.yaml --output tsv
```

## Notes / assumptions
- RAGThoven supports `results.output_field` (used for TSV second column name)
- Output filenames are `task-a-<lang>.tsv` under the default output directory
