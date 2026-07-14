#!/usr/bin/env python3
"""Minimal Streamlit viewer for Subtask A side-by-side outputs."""

from __future__ import annotations

import json
from pathlib import Path
import re

import pandas as pd
import streamlit as st


REPO_ROOT = Path(__file__).resolve().parents[1]
INPUTS_DIR = REPO_ROOT / "data" / "trial"
LANG_RE = re.compile(r"task-a-(en|es|zh)")


def load_manifest() -> pd.DataFrame:
    records: list[dict[str, object]] = []
    for tsv_path in REPO_ROOT.glob("experiments/*/outputs/**/*.tsv"):
        try:
            rel_path = tsv_path.relative_to(REPO_ROOT)
        except ValueError:
            continue
        parts = rel_path.parts
        if "experiments" not in parts or "outputs" not in parts:
            continue
        exp_idx = parts.index("experiments")
        outputs_idx = parts.index("outputs")
        if exp_idx + 1 >= len(parts):
            continue
        experiment = parts[exp_idx + 1]
        subset = parts[outputs_idx + 1] if outputs_idx + 1 < len(parts) else "outputs"

        name_parts = tsv_path.name.split(".")
        if len(name_parts) < 3:
            continue
        base_name = ".".join(name_parts[:-2])
        hash_part = name_parts[-2]

        lang_match = LANG_RE.search(base_name)
        if not lang_match:
            continue
        lang = lang_match.group(1)

        metadata_path = tsv_path.with_name(f"{base_name}.{hash_part}.metadata.json")
        model = None
        temperature = None
        config_name = None
        if metadata_path.exists():
            try:
                with metadata_path.open("r", encoding="utf-8") as f:
                    metadata = json.load(f)
            except (OSError, json.JSONDecodeError):
                metadata = None
            if isinstance(metadata, dict):
                llm = metadata.get("llm") if isinstance(metadata.get("llm"), dict) else {}
                if isinstance(llm, dict):
                    model = llm.get("model")
                    temperature = llm.get("temperature")
                config_name = metadata.get("name")

        mtime = tsv_path.stat().st_mtime
        run_id = f"{experiment}/{subset}/{base_name}.{hash_part}"
        group_key = f"{experiment}|{subset}|{lang}|{base_name}"

        records.append(
            {
                "run_id": run_id,
                "experiment": experiment,
                "subset": subset,
                "lang": lang,
                "base_name": base_name,
                "hash": hash_part,
                "tsv_path": str(rel_path),
                "model": model,
                "temperature": temperature,
                "config_name": config_name,
                "mtime": mtime,
                "group_key": group_key,
            }
        )

    if not records:
        return pd.DataFrame()

    manifest = pd.DataFrame.from_records(records)
    manifest["is_latest"] = False
    latest_idx = manifest.groupby("group_key")["mtime"].idxmax()
    manifest.loc[latest_idx, "is_latest"] = True
    return manifest


@st.cache_data(show_spinner=False)
def load_inputs(lang: str) -> pd.DataFrame:
    input_path = INPUTS_DIR / f"task-a-{lang}.tsv"
    return pd.read_csv(input_path, sep="\t")


@st.cache_data(show_spinner=False)
def load_output_map(rel_path: str) -> pd.Series:
    output_path = REPO_ROOT / rel_path
    df = pd.read_csv(output_path, sep="\t")
    if "id" not in df.columns:
        raise ValueError(f"Output TSV missing id column: {output_path}")
    output_cols = [col for col in df.columns if col != "id"]
    if not output_cols:
        raise ValueError(f"Output TSV missing output column: {output_path}")
    return df.set_index("id")[output_cols[0]]


def build_run_label(row: pd.Series) -> str:
    model = row.get("model") or ""
    model_part = f" | {model}" if model else ""
    return f"{row['experiment']}/{row['subset']} | {row['base_name']}.{row['hash']}{model_part}"


st.set_page_config(page_title="MWAHAHA Subtask A Viewer", layout="wide")

st.title("MWAHAHA Subtask A Viewer")

if st.button("Refresh runs"):
    st.cache_data.clear()
    st.rerun()

manifest = load_manifest()
if manifest.empty:
    st.warning("No outputs found under experiments/*/outputs.")
    st.stop()

langs = sorted(manifest["lang"].dropna().unique().tolist())
lang = st.selectbox("Language", langs, index=0 if langs else None)
latest_only = st.checkbox("Latest only", value=True)

filtered = manifest[manifest["lang"] == lang]
if latest_only and "is_latest" in filtered.columns:
    filtered = filtered[filtered["is_latest"]]

filtered = filtered.copy()
filtered["label"] = filtered.apply(build_run_label, axis=1)
label_to_run = dict(zip(filtered["label"], filtered["run_id"]))

def pick_default_labels(data: pd.DataFrame) -> list[str]:
    defaults: list[str] = []
    for experiment in sorted(data["experiment"].unique()):
        exp_rows = data[data["experiment"] == experiment].copy()
        if exp_rows.empty:
            continue
        exp_rows["full_preferred"] = exp_rows["subset"].astype(str).str.contains("full", case=False, na=False)
        exp_rows = exp_rows.sort_values(
            by=["full_preferred", "is_latest", "mtime"],
            ascending=[False, False, False],
        )
        defaults.append(exp_rows.iloc[0]["label"])
    return defaults

selected_labels = st.multiselect(
    "Runs",
    options=filtered["label"].tolist(),
    default=pick_default_labels(filtered),
)

search = st.text_input("Search id/headline")

if not selected_labels:
    st.info("Select at least one run to compare.")
    st.stop()

inputs = load_inputs(lang)
filtered_inputs = inputs.copy()
if search:
    mask = filtered_inputs["id"].astype(str).str.contains(search, case=False, na=False)
    if "headline" in filtered_inputs.columns:
        mask |= filtered_inputs["headline"].astype(str).str.contains(search, case=False, na=False)
    filtered_inputs = filtered_inputs[mask]

if filtered_inputs.empty:
    st.warning("No samples match the current search.")
    st.stop()

display_map = {
    row["id"]: f"{row['id']} | {row.get('headline', '')}" for _, row in filtered_inputs.iterrows()
}
options = filtered_inputs["id"].tolist()
if "selected_id" not in st.session_state or st.session_state["selected_id"] not in options:
    st.session_state["selected_id"] = options[0]

current_index = options.index(st.session_state["selected_id"])

nav_cols = st.columns([1, 1, 6])
with nav_cols[0]:
    if st.button("Prev", use_container_width=True) and current_index > 0:
        st.session_state["selected_id"] = options[current_index - 1]
with nav_cols[1]:
    if st.button("Next", use_container_width=True) and current_index < len(options) - 1:
        st.session_state["selected_id"] = options[current_index + 1]

selected_id = st.selectbox(
    "Sample",
    options=options,
    index=options.index(st.session_state["selected_id"]),
    format_func=lambda value: display_map.get(value, value),
    key="selected_id",
)

sample_row = filtered_inputs.loc[filtered_inputs["id"] == selected_id].iloc[0]

st.subheader("Input")
input_cols = st.columns(3)
with input_cols[0]:
    st.markdown(f"**id**: {sample_row['id']}")
    st.markdown(f"**word1**: {sample_row.get('word1', '')}")
with input_cols[1]:
    st.markdown(f"**word2**: {sample_row.get('word2', '')}")
with input_cols[2]:
    st.markdown(f"**lang**: {lang}")
st.markdown(f"**headline**: {sample_row.get('headline', '')}")

st.subheader("Outputs")
run_outputs: list[tuple[str, str]] = []
for label in selected_labels:
    run_id = label_to_run[label]
    run_row = filtered.loc[filtered["run_id"] == run_id].iloc[0]
    output_series = load_output_map(run_row["tsv_path"])
    run_outputs.append((label, output_series.get(selected_id, "")))

chunk_size = 4
for i in range(0, len(run_outputs), chunk_size):
    chunk = run_outputs[i : i + chunk_size]
    cols = st.columns(len(chunk))
    for col, (label, output_text) in zip(cols, chunk):
        with col:
            st.markdown(f"**{label}**")
            st.write(output_text or "")
