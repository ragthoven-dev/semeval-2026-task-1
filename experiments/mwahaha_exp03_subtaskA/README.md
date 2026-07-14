# Experiment 03: MWAHAHA Subtask A (v3 prompts)

This experiment introduces **v3 prompts** and runs with `gpt-5-2025-08-07` at temperature 1.

## What changed from exp01
- **Last-clause twist**: final clause must reframe the setup
- **Cliché ban list**: judge rejects common template openers
- **Exact word inclusion**: word1/word2 must appear exactly as given (literal substring)
- **Headline anchor tokens**: reuse 1–2 exact headline tokens
- **Serious headline framing**: redirect to systems/objects, avoid victims

## Inputs
Trial data (committed):
- `data/trial/task-a-en.tsv`
- `data/trial/task-a-es.tsv`
- `data/trial/task-a-zh.tsv`

Columns: `id`, `word1`, `word2`, `headline`
- If `word1` or `word2` is `-`, treat it as no constraint
- Otherwise both words must appear **exactly** in the joke

## Prompt assets
- Prompts live directly in `config/*.yaml` (`llm.prompts`); there are no separate template files.
- `mechanisms.yaml` is kept as a reference list (same 16 mechanisms as exp01).

## Run commands
EN:
```bash
ragthoven experiments/mwahaha_exp03_subtaskA/config/en.yaml --output tsv
```

ES:
```bash
ragthoven experiments/mwahaha_exp03_subtaskA/config/es.yaml --output tsv
```

ZH:
```bash
ragthoven experiments/mwahaha_exp03_subtaskA/config/zh.yaml --output tsv
```

## Notes / assumptions
- RAGThoven supports `results.output_field` (used for TSV second column name)
- Input datasets are TSV; current loader expects `csv:` and will require TSV→CSV conversion unless updated upstream
