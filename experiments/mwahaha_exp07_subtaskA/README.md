# Experiment 07: MWAHAHA Subtask A (v7 metacognitive prompts)

This experiment implements MP (Metacognitive Prompting) from the AAAI 2025 paper "MP: Endowing Large Language Models with Lateral Thinking" and adapts it to humor generation. MP decomposes the task into Planning -> Reasoning -> Reflecting, which aligns well with our planner/writer/judge pipeline. We add an explicit reflection stage and metacognitive checkpoints to reduce literal outputs and improve creative twists.

## Research inspiration (for paper framing)
- MP proposes metacognitive prompting with Planning, Reasoning, and Reflecting to boost lateral thinking. It explicitly uses task knowledge, strategies, and pitfall awareness, then reflects to correct errors. [1]
- The paper reports consistent gains over standard prompting and CoT on multiple lateral-thinking datasets, showing that reflection improves creative reasoning. [1]

## Hypotheses
1. A reflection stage that diagnoses failure modes (literalism, weak twist, headline copying) will improve joke quality.
2. Explicit metacognitive planning (pitfalls + strategy + trick type) will increase novelty without violating constraints.
3. The planner + reflector loop will reduce "almost good" jokes that fail on a single constraint.

## What changes vs exp06
- **Metacognitive planning**: planner outputs pitfalls, strategy, trick type, and checkpoints.
- **Reflection stage**: a new reflector rewrites top candidates after diagnosing failures.
- **MP alignment**: writer uses trick type and checkpoints; judge prefers reflector rewrites when valid.

## How it works (pipeline outline)

### 1) Planner (MP: Planning)
The planner declares the intended strategy and risks before writing any text.

Required internal fields:
- PITFALLS: 2-3 likely errors (headline copying, weak twist, etc.)
- STRATEGY: chosen strategy + backup
- TRICK_TYPE: metaphor, literalization, personification, role reversal, genre shift, etc.
- CHECKPOINTS: 2-3 constraints to verify later
- SCRIPT_A / SCRIPT_B / VIOLATION / BENIGNING / PIVOT
- ANCHOR_TOKENS, WORDPAIR_LINK, PREMISES, MECHANISMS

### 2) Writer (MP: Reasoning)
- Generates 12 candidates using the declared trick type.
- Performs a self-check for each candidate.
- Avoids semicolons and keeps language natural; length can vary if it helps the joke.

### 3) Reflector (MP: Reflecting)
- Diagnoses issues in the candidate set (literalism, missing twist, headline copy, etc.).
- Produces 1-2 rewritten candidates that fix the detected issues.

### 4) Judge
- Chooses the best valid output from the reflector rewrites or the original candidates.
- Prioritizes valid reflector rewrites if they improve twist clarity and humor.

## Evaluation plan
- Automated checks: headline overlap, word-pair inclusion, semicolon count.
- Human slice (100-200): funniness, clarity of twist, naturalness, safety.
- Compare to exp06 (v6) as the primary baseline.

## Inputs
Trial data (committed):
- `data/trial/task-a-en.tsv`
- `data/trial/task-a-es.tsv`
- `data/trial/task-a-zh.tsv`

## Prompt assets
- Prompts live directly in `config/*.yaml` (`llm.prompts`).

## Run commands
Run from the repo root using Poetry to invoke the ragthoven CLI:

EN:
```bash
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp07_subtaskA/config/en.yaml --output tsv
```

ES:
```bash
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp07_subtaskA/config/es.yaml --output tsv
```

ZH:
```bash
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp07_subtaskA/config/zh.yaml --output tsv
```

## References
1. Bai, T., Cao, Y., Ge, Y., Yu, H. (2025). MP: Endowing Large Language Models with Lateral Thinking. AAAI. https://ojs.aaai.org/index.php/AAAI/article/view/34514
