#!/usr/bin/env python3
import argparse
import csv
import json
import re
from pathlib import Path


def read_tsv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def tokenize(text):
    return re.findall(r"[A-Za-z0-9]+", text.lower())


def longest_common_token_span(a, b):
    at = tokenize(a)
    bt = tokenize(b)
    longest = 0
    for i in range(len(at)):
        for j in range(len(bt)):
            k = 0
            while i + k < len(at) and j + k < len(bt) and at[i + k] == bt[j + k]:
                k += 1
            if k > longest:
                longest = k
    return longest


def same_clause(text, word1, word2):
    clauses = re.split(r"[.!?;,:]+", text)
    return any(word1 in c and word2 in c for c in clauses)


def evaluate(input_rows, pred_rows):
    by_id = {r["id"]: r for r in pred_rows}
    stats = {
        "rows": len(input_rows),
        "missing_output": 0,
        "non_empty": 0,
        "no_semicolon": 0,
        "headline_anchor": 0,
        "headline_exact_copy": 0,
        "headline_overlap_too_high": 0,
        "word1_present": 0,
        "word2_present": 0,
        "wordpair_same_clause": 0,
        "hard_pass": 0,
    }

    for row in input_rows:
        rid = row["id"]
        pred = by_id.get(rid, {}).get("text", "")
        pred = pred.strip()

        if not pred:
            stats["missing_output"] += 1
            continue

        stats["non_empty"] += 1

        ok = True
        if ";" not in pred:
            stats["no_semicolon"] += 1
        else:
            ok = False

        headline = row["headline"].strip()
        if headline != "-":
            h_tokens = {t for t in tokenize(headline) if len(t) >= 4}
            p_tokens = set(tokenize(pred))
            if len(h_tokens.intersection(p_tokens)) >= 1:
                stats["headline_anchor"] += 1
            else:
                ok = False

            if pred.lower().strip() == headline.lower().strip():
                stats["headline_exact_copy"] += 1
                ok = False

            if longest_common_token_span(pred, headline) >= 6:
                stats["headline_overlap_too_high"] += 1
                ok = False

        word1 = row["word1"].strip()
        word2 = row["word2"].strip()

        if word1 != "-":
            if word1 in pred:
                stats["word1_present"] += 1
            else:
                ok = False

        if word2 != "-":
            if word2 in pred:
                stats["word2_present"] += 1
            else:
                ok = False

        if word1 != "-" and word2 != "-":
            if same_clause(pred, word1, word2):
                stats["wordpair_same_clause"] += 1
            else:
                ok = False

        if ok:
            stats["hard_pass"] += 1

    return stats


def summarize(stats):
    rows = max(stats["rows"], 1)

    def pct(k):
        return 100.0 * stats[k] / rows

    out = {
        "rows": stats["rows"],
        "non_empty_rate": pct("non_empty"),
        "no_semicolon_rate": pct("no_semicolon"),
        "headline_anchor_rate": pct("headline_anchor"),
        "headline_exact_copy_rate": pct("headline_exact_copy"),
        "headline_overlap_too_high_rate": pct("headline_overlap_too_high"),
        "hard_constraint_pass_rate": pct("hard_pass"),
    }

    if stats["word1_present"] > 0 or stats["word2_present"] > 0:
        out["word1_present_rate"] = pct("word1_present")
        out["word2_present_rate"] = pct("word2_present")
        out["wordpair_same_clause_rate"] = pct("wordpair_same_clause")

    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--pred", nargs="+", required=True)
    args = parser.parse_args()

    inputs = read_tsv(args.input)
    report = {}
    for p in args.pred:
        preds = read_tsv(p)
        report[Path(p).name] = summarize(evaluate(inputs, preds))

    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
