# Experiment 06: MWAHAHA Subtask A (v6 theory-driven prompts)

This experiment proposes a **theory-driven prompting and selection framework** that explicitly encodes humor mechanics (incongruity + benign violation + twist placement) rather than relying only on rhetorical mechanisms. The goal is to increase *true* joke quality (surprise + resolution) while preserving safety and task constraints.

## Research inspiration (for paper framing)
- **Incongruity / Incongruity-Resolution**: humor arises from a violated expectation that is then (partly) resolved. [1]
- **Script opposition**: two incompatible frames (scripts) collide; the punchline flips the interpretation. [2]
- **Benign violation**: the violation must be safe, distant, or trivial enough to be humorous. [3]
- **Surprisal as a humor signal**: surprise/uncertainty features help distinguish jokes from non-jokes and correlate with creative language such as humor. [4,5]

These are *not* the same as the mechanism list; mechanisms are rhetorical tools, while these are the *conditions* that make a tool land.

## Hypotheses
1. Explicitly modeling script opposition + benignness will raise average perceived funniness.
2. Enforcing a punchline pivot (twist in the final clause) will improve clarity and reduce diffuse setups.
3. Reranking by surprise/clarity/benignness will outperform a single-pass generation.
4. Headline paraphrase rates will drop without losing topical relevance.

## What changes vs exp05
- **Planner must declare script opposition** (Script A vs Script B) and the *violation + benigning factor*.
- **Punchline pivot** required: the last clause must contain the twist.
- **Word-pair interaction**: when `headline` is `-`, word1/word2 must interact in the same clause.
- **Surprise-first rerank**: judge selects by surprise + resolution + benignness, not just headline fit.
- **Length flexibility**: length can vary for funnier jokes; 2-3 sentences are preferred over semicolons.
- **No semicolons**: ";" is disallowed as a structural crutch.
- **ALL-CAPS normalization**: all-caps headlines are interpreted as normal case (no shouting style).

## How it works (pipeline outline)

### 1) Planner (ideation)
The planner explicitly commits to the humor structure before any text is written.

Required internal fields:
- SCRIPT A: expected frame (literal, mundane interpretation)
- SCRIPT B: opposed frame (absurd, literalized, genre-shifted, etc.)
- VIOLATION: what gets broken (social norm, logic, role, scale)
- BENIGNING: why it's safe/funny (distance, object target, absurdity)
- PIVOT WORD/CONCEPT: the twist anchor for the final clause
- SETUP GIST / PUNCHLINE GIST: one-line plan of the reversal
- ANCHOR TOKENS: 1-2 exact headline tokens to reuse (headline case only)
- WORD-PAIR LINK: how word1/word2 will causally interact (word-pair case)
- MECHANISMS: 6-10 from the library (optional guidance)
- PREMISES: 6-8 distinct angles

### 2) Writer (candidate generation)
- Generates 10-12 candidates using the planner plan.
- Enforces the **pivot in the final clause**.
- Keeps length tight (target 16-24 words; allow up to ~32 only if necessary).
- Avoids headline paraphrase; uses only short anchor tokens.
- Enforces word1/word2 interaction when headline is `-`.

### 3) Judge (selection + polish)
- Hard filters: safety, constraints, anchor tokens, no headline copy, no missing word-pair.
- Scoring rubric (1-5 each):
  - Surprise (incongruity strength)
  - Resolution (clear reinterpretation)
  - Benignness (safe target)
  - Specificity (headline or word-pair relevance)
  - Punchiness (brevity + clean landing)
- Selects the top-scoring candidate; light polish only.

## Evaluation plan
- **Automated checks** (EN/ES/ZH):
  - Headline overlap rate (exact + heavy overlap)
  - Word-pair inclusion + co-occurrence in same clause
  - Length distribution (targeting 16-24 words)
- **Human annotation slice** (100-200 items):
  - Funniness (1-5)
  - Surprise/Resolution (1-5)
  - Safety/comfort (1-5)
  - Fluency (1-5)
- **Comparative baseline**: exp05 full outputs as the primary control.

## Risks + mitigations
- **Over-formalization** -> jokes feel mechanical. Mitigate via diverse mechanisms and multiple premises.
- **Too-safe outputs** -> bland. Mitigate with explicit violation + benigning balance.
- **Cross-lingual drift** -> pivot constraint may not transfer. Adjust length/pivot wording for ES/ZH if needed.

## Inputs
Trial data (committed):
- `data/trial/task-a-en.tsv`
- `data/trial/task-a-es.tsv`
- `data/trial/task-a-zh.tsv`

Columns: `id`, `word1`, `word2`, `headline`
- If `word1` or `word2` is `-`, treat it as no constraint
- If `headline` is `-`, do NOT reference a headline; word1/word2 are required instead

## Prompt assets
- Prompts live directly in `config/*.yaml` (`llm.prompts`).
- Mechanism library is included in the planner prompt.

## Run commands
EN:
```bash
ragthoven experiments/mwahaha_exp06_subtaskA/config/en.yaml --output tsv
```

ES:
```bash
ragthoven experiments/mwahaha_exp06_subtaskA/config/es.yaml --output tsv
```

ZH:
```bash
ragthoven experiments/mwahaha_exp06_subtaskA/config/zh.yaml --output tsv
```

## Notes / assumptions
- RAGThoven supports TSV inputs via the `tsv:` dataset prefix.
- Outputs should be written to `experiments/mwahaha_exp06_subtaskA/outputs/...` with `v6` filenames.

## References
1. Suls, J. (1972). A two-stage model for the appreciation of jokes and cartoons. In P. E. Goldstein & J. H. McGhee (Eds.), *The Psychology of Humor* (pp. 81-100). Summary discussion in Stanford Encyclopedia of Philosophy: https://plato.stanford.edu/entries/humor/
2. Raskin, V. (1985). *Semantic Mechanisms of Humor*. Springer. DOI: https://doi.org/10.1007/978-94-009-6472-3_4
3. McGraw, A. P., & Warren, C. (2010). Benign Violations: Making Immoral Behavior Funny. *Psychological Science*, 21(8), 1141-1149. DOI: https://doi.org/10.1177/0956797610376073
4. Xie, Y., Li, J., & Pu, P. (2021). Uncertainty and Surprisal Jointly Deliver the Punchline: Exploiting Incongruity-Based Features for Humor Recognition. *ACL-IJCNLP 2021*. https://aclanthology.org/2021.acl-short.6/
5. Bunescu, R. C., & Uduehi, O. O. (2022). Distribution-Based Measures of Surprise for Creative Language: Experiments with Humor and Metaphor. *Fig-Lang 2022*. https://aclanthology.org/2022.flp-1.10/
