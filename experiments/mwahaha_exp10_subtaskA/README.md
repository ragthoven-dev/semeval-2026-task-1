# Experiment 10: MWAHAHA Subtask A (v10 autonomous branching)

This experiment ports the exp08 planner/writer/reflector/judge structure into
an explicitly autonomous iterative workflow. The orchestrator is allowed to
choose its own tool order, explore multiple independent branches, and converge
only after deterministic audit passes.

## Variants
- Agentic autonomous branching + `ConstraintAudit` (`gpt-5`)
- Agentic autonomous branching + `ConstraintAudit` (`google.gemini-3-pro-global`)
- Agentic autonomous branching + `ConstraintAudit` (`Claude Sonnet 4.5`)
- Agentic autonomous branching + `ConstraintAudit` (`Claude Opus 4.5`)

## Agentic policy highlights
- Dynamic tool ordering (no hardcoded sequence)
- 2-4 independent branches per example
- Cross-branch shortlist and judge selection
- Audit-driven repair/replan loop before final output
- `parallel_tool_calls: true` and `max_iterations: 36`

## Sample slice
- Input file: `experiments/mwahaha_exp10_subtaskA/data/task-a-en-trial-sample12.tsv`
- Source: `data/trial/task-a-en.tsv` (train-backed trial split, ids `en_0001+`)

## Run
From repo root:

```bash
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp10_subtaskA/config/en_agentic_gpt5_sample.yaml --output tsv
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp10_subtaskA/config/en_agentic_gemini3pro_sample.yaml --output tsv
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp10_subtaskA/config/en_agentic_claude45_sample.yaml --output tsv
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp10_subtaskA/config/en_agentic_claude_opus45_sample.yaml --output tsv
```

## Quick comparison

```bash
python experiments/mwahaha_exp10_subtaskA/analysis/evaluate_outputs.py \
  --input experiments/mwahaha_exp10_subtaskA/data/task-a-en-trial-sample12.tsv \
  --pred <output1.tsv> <output2.tsv> <output3.tsv> <output4.tsv>
```
