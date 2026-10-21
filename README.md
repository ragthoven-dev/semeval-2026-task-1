# RAGthoven at SemEval-2026 Task 1 (MWAHAHA)

Code, prompts, and configurations for **RAGthoven**, our system for
[SemEval-2026 Task 1 (MWAHAHA)](https://pln-fing-udelar.github.io/semeval-2026-humor-gen/),
**Subtask A** — multilingual constrained humor generation in English, Spanish,
and Chinese.

**[Explore the interactive website](https://ragthoven-dev.github.io/semeval-2026-task-1/)**
to browse generated headline jokes, search the retrieval corpus, explore humor
mechanisms, inspect recorded RAG examples, and prepare prompts for your own
headlines. The site runs in your browser without model credentials; live joke
generation uses your chosen model separately.

RAGthoven decomposes humor generation into a multi-stage LLM pipeline —
**Planner → Best-of-N Writer → Reflector → Judge** — grounded in computational
humor theory (Benign Violation Theory, Script-based Semantic Theory of Humor).
The final configuration augments the Planner with retrieval-augmented generation
(RAG) over a curated joke corpus, and two agentic tool-calling variants expose
the same stages behind a deterministic `ConstraintAudit` checker.

This repository accompanies the system-description paper
([Suppa et al., SemEval 2026](https://aclanthology.org/2026.semeval-1.416/); see
[Citation](#citation)). It contains the RAGthoven-framework configs (prompts) for
all ten experiments, the joke retrieval corpus, the agentic subagent toolchain,
representative outputs, and our official leaderboard submission.

## Repository layout

```
experiments/
  mwahaha_exp01_subtaskA/ … mwahaha_exp10_subtaskA/
    config/         RAGthoven YAML configs (prompts + pipeline) per language/model
    mechanisms.yaml humor-mechanism reference list (exp01–06)
    outputs/        representative generated outputs (+ run metadata)
    README.md       experiment notes
    data/           12-row EN sample slice (exp09–10 only)
    analysis/       deterministic constraint checker (exp09–10 only)
data/
  jokes/joke_summaries.tsv   98-entry joke RAG corpus
  README.md                  how to obtain the official trial/test data
mwahaha_submission/          our official Subtask A leaderboard submission (EN/ES/ZH)
viewer/                      Streamlit tool to compare outputs side by side
site/                        public showcase, libraries, and headline prompt builder
ragthoven/                   RAGthoven framework (git submodule)
```

## Setup

RAGthoven is included as a git submodule. Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/ragthoven-dev/semeval-2026-task-1.git
cd semeval-2026-task-1
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

Install the framework (in the submodule) with Poetry:

```bash
poetry -C ragthoven install
```

The pinned `ragthoven` commit includes the cross-provider tool-calling support
and the MWAHAHA subagent toolchain required by the agentic experiments
(Exp09–Exp10).

Set your model provider credentials via environment variables (e.g.
`OPENAI_API_KEY`). The configs use provider defaults; to route through a custom
endpoint, add a `base_url` under `llm:` in the relevant config.

## Data

The joke RAG corpus ships in `data/jokes/joke_summaries.tsv`. The official
Subtask A trial/test inputs are **not redistributed** — download them from the
[task resources](https://www.codabench.org/competitions/9719/) into
`data/trial/` and `data/test/`. See [`data/README.md`](data/README.md).

## Running an experiment

`poetry -C ragthoven run` executes with the working directory set to
`ragthoven/`, so config paths are written relative to it (`../experiments/...`),
and the configs' internal `../data/...` references resolve to this repo's
`data/`. Run from the repo root:

```bash
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp08_subtaskA/config/en.yaml --output tsv
```

The agentic variants (Exp09/10) reference the MWAHAHA subagent tools
(`mwahaha_tools.PlannerSubagent`, …, `mwahaha_tools.ConstraintAudit`), which
ship inside the pinned `ragthoven` submodule at
`ragthoven/ragthoven/tools/mwahaha_tools.py`:

```bash
poetry -C ragthoven run ragthoven ../experiments/mwahaha_exp09_subtaskA/config/en_agentic_gpt5_sample.yaml --output tsv
```

Each experiment's `README.md` lists its variants and exact run/evaluation
commands.

## Experiments

| Exp | Key addition | Model(s) | N | Reflector | RAG |
|----|---------------------------------------------------------|-------------------------------|------|:---------:|:---:|
| 01 | Config-driven baseline: Planner → Writer → Judge        | GPT-4.1                       | 4    |           |     |
| 02 | Last-clause twist, cliché ban, exact word inclusion     | GPT-4.1                       | 4    |           |     |
| 03 | `TRICK_TYPE` planner fields, model upgrade              | GPT-5                         | 4    |           |     |
| 04 | Best-of-12 candidate generation                        | GPT-5                         | 12   |           |     |
| 05 | Conditional prompts (headline-absent branch)           | GPT-5                         | 12   |           |     |
| 06 | Explicit SSTH script-opposition, BVT modeling          | GPT-5                         | 10–12|           |     |
| 07 | Metacognitive Reflector stage                          | GPT-5                         | 12   | ✓         |     |
| 08 | RAG-augmented Planner, multiple models (**final**)     | GPT-5 / Gemini / Sonnet       | 12   | ✓         | ✓   |
| 09 | Four-stage subagents via tool calls + `ConstraintAudit`| GPT-5 / Gemini / Sonnet / Opus| iter.| ✓         | ✓   |
| 10 | Autonomous multi-branch exploration                    | GPT-5 / Gemini / Sonnet / Opus| iter.| ✓         | ✓   |

Exp01–08 target EN/ES/ZH; Exp09–10 are evaluated on a held-out English sample.

## Results

RAGthoven shares Rank 1 with the Gemini 2.5 Flash baseline in all three
languages, with the highest raw Elo rating in Spanish (1182 vs. 1140). Neither
agentic variant (Exp09/10) produced outputs we judged superior to the
non-agentic pipeline despite substantially higher tool-call budgets. See the
paper for full leaderboards and analysis.

## Viewer

The [public website](https://ragthoven-dev.github.io/semeval-2026-task-1/)
includes the curated showcase and libraries. See [`site/README.md`](site/README.md)
for local preview, data updates, and GitHub Pages deployment.

```bash
uv run streamlit run viewer/app.py
```

Compares Subtask A outputs across experiments side by side. See
[`viewer/README.md`](viewer/README.md).

## Citation

If you use this work, please cite the paper
([ACL Anthology](https://aclanthology.org/2026.semeval-1.416/)):

```bibtex
@inproceedings{suppa-etal-2026-ragthoven,
    title = "{RAG}thoven at {S}em{E}val-2026 Task 1: A Multi-Stage Pipeline Walks Into a Benchmark and Barely Clears the Bar",
    author = "Suppa, Marek  and
      Ondrejov{\'a}, Vikt{\'o}ria  and
      Ganajov{\'a}, Lucia  and
      Karetka, Gregor  and
      Skala, Daniel",
    editor = "Kochmar, Ekaterina  and
      Ghosh, Debanjan  and
      North, Kai  and
      Komachi, Mamoru  and
      Zampieri, Marcos",
    booktitle = "Proceedings of the 20th International Workshop on Semantic Evaluation (2026)",
    month = jul,
    year = "2026",
    address = "San Diego, California, USA",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2026.semeval-1.416/",
    doi = "10.18653/v1/2026.semeval-1.416",
    pages = "3343--3356",
    ISBN = "979-8-89176-414-9",
}
```

The RAGthoven framework itself is described in Karetka et al. (2025); see the
[`ragthoven`](https://github.com/ragthoven-dev/ragthoven) repository.

## Acknowledgements

This research was partially supported by grant APVV-21-0114.
