# Experiment 08: MWAHAHA Subtask A (v8 jokes-as-inspiration RAG)

This experiment adds retrieval over a curated corpus of punchy, news-style joke lines (with summaries) to seed the planner with fresh mechanisms and angles. The jokes/summaries are used as *style/structure inspiration only*; prompts explicitly ban copying wording or specific entities.

## Hypotheses
1. Retrieved joke lines + summaries will increase punchline variety without violating constraints.
2. Mechanism labels will improve twist selection and reduce bland literalism.
3. Light RAG context will help the planner avoid repetitive templates.

## What changes vs exp07
- Adds a punchy jokes corpus (`data/jokes/joke_summaries.tsv`) as `training_data`.
- Enables retrieval + reranking and injects the top jokes/summaries into the planner prompt.
- Explicitly bans copying phrasing/details from the jokes/summaries.

## Inputs
Trial data (committed):
- `data/trial/task-a-en.tsv`

Joke summaries (new):
- `data/jokes/joke_summaries.tsv`

## Prompt assets
- Prompts live directly in `config/en.yaml` (`llm.prompts`).
- Retrieved examples are passed via `{{ examples }}` in the planner stage.

## Run command
Run from the repo root using Poetry to invoke the ragthoven CLI:

EN:
```bash
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp08_subtaskA/config/en.yaml --output tsv
```
