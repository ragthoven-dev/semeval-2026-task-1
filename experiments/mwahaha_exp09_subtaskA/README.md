# Experiment 09: MWAHAHA Subtask A (v9 agentic iterative)

This experiment tests ragthoven iterative tool-calling mode for Subtask A with
explicit planner/writer/reflector/judge subagents.

## Variants
- Agentic iterative (4 subagents + `ConstraintAudit`) (`gpt-5`)
- Agentic iterative (4 subagents + `ConstraintAudit`) (`google.gemini-3-pro-global`)
- Agentic iterative (4 subagents + `ConstraintAudit`) (`Claude Sonnet 4.5`)
- Agentic iterative (4 subagents + `ConstraintAudit`) (`Claude Opus 4.5`)
- Baseline non-agentic (`exp08`-style prompts, `gpt-5`)

## Sample slice
- Input file: `experiments/mwahaha_exp09_subtaskA/data/task-a-en-trial-sample12.tsv`
- Source: `data/trial/task-a-en.tsv` (train-backed trial split, ids `en_0001+`)

## Run
From repo root:

```bash
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp09_subtaskA/config/en_agentic_gpt5_sample.yaml --output tsv
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp09_subtaskA/config/en_agentic_gemini3pro_sample.yaml --output tsv
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp09_subtaskA/config/en_baseline_gpt5_sample.yaml --output tsv
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp09_subtaskA/config/en_agentic_claude45_sample.yaml --output tsv
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp09_subtaskA/config/en_agentic_claude_opus45_sample.yaml --output tsv
```

## Quick comparison

```bash
python experiments/mwahaha_exp09_subtaskA/analysis/evaluate_outputs.py \
  --input experiments/mwahaha_exp09_subtaskA/data/task-a-en-trial-sample12.tsv \
  --pred <output1.tsv> <output2.tsv> <output3.tsv> <output4.tsv> <output5.tsv>
```
