#!/usr/bin/env python3
"""Validate the public snapshot and deterministically rebuild its downloads.

The committed catalog preserves showcase text and selected recorded prompts.
Jokes and reference mechanisms are refreshed from the public repository files.
This script uses only the Python standard library and makes no network calls.
"""

import argparse
import csv
import io
import ipaddress
import json
from pathlib import Path
import re
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "site/data/catalog.json"
JOKE_SOURCE = ROOT / "data/jokes/joke_summaries.tsv"
MECHANISM_SOURCE = ROOT / "experiments/mwahaha_exp05_subtaskA/mechanisms.yaml"
JOKE_FIELDS = ("id", "joke", "summary", "mechanism", "topic", "source")
MECHANISM_FIELDS = ("name", "desc", "ex1", "ex2")
SHOWCASE_FIELDS = ("id", "headline", "text", "first_batch")
STAGE_FIELDS = ("inspiration", "system_prompt", "user_prompt")
USAGE_FIELDS = ("id", "headline", "final_joke", "retrieved_source_ids", "planner", "writer")
PRIVATE_KEYS = {"endpoint", "authorization", "api_key", "api_token", "access_token",
                "extra_headers", "base_url", "environment", "raw_trace", "trace_path"}
PRIVATE_VALUE = re.compile(
    r"/Users/|/home/|/tmp/|/private/|[A-Za-z]:\\|file://|"
    r"llm-proxy|webex\.com|x-cisco-app|OPENAI_API_KEY|"
    r"\b(?:api[_-]?key|api[_-]?token|authorization|base_url)\s*[:=]|"
    r"\bBearer\s+[A-Za-z0-9._~-]+|\bsk-[A-Za-z0-9_-]{20,}",
    re.IGNORECASE,
)
UNSAFE_HTML = re.compile(
    r"<\s*/?\s*(?:script|iframe|object|embed|svg|img)\b|"
    r"javascript\s*:|data\s*:\s*text/html|\bon\w+\s*=",
    re.IGNORECASE,
)


def read_jokes(path=JOKE_SOURCE):
    with path.open(newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source, delimiter="\t")
        if tuple(reader.fieldnames or ()) != JOKE_FIELDS:
            raise ValueError("Public joke source has unexpected columns")
        return list(reader)


def read_mechanisms(path=MECHANISM_SOURCE):
    """Read the reference file's flat fields, including its existing YAML quirks.

    Some descriptions start with a quoted fragment and continue with plain
    text. They are readable reference prose but do not parse as strict YAML.
    Preserve that prose; decode only complete JSON-style quoted field values.
    """
    records = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith("- name: "):
            records.append({"name": line[len("- name: "):]})
            continue
        match = re.fullmatch(r"  (desc|ex1|ex2): (.*)", line)
        if not records or not match:
            raise ValueError(f"Unsupported mechanism reference line {line_number}")
        key, value = match.groups()
        if key in records[-1]:
            raise ValueError(f"Duplicate mechanism field at line {line_number}")
        if value.startswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                pass
        records[-1][key] = value
    return records


def public_strings(value, location="catalog"):
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in PRIVATE_KEYS:
                raise ValueError(f"{location}: private request metadata is not public site data")
            yield from public_strings(item, f"{location}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from public_strings(item, f"{location}[{index}]")
    elif isinstance(value, str):
        yield location, value


def validate_public_strings(catalog):
    for location, value in public_strings(catalog):
        if PRIVATE_VALUE.search(value) or UNSAFE_HTML.search(value):
            raise ValueError(f"{location}: prohibited local, service, or HTML content")
        for match in re.finditer(r"https?://[^\s<>\"']+", value):
            url = urlsplit(match.group())
            host = (url.hostname or "").lower()
            try:
                private_address = not ipaddress.ip_address(host).is_global
            except ValueError:
                private_address = False
            if (url.username or url.password or not host or host in
                    {"localhost", "127.0.0.1", "0.0.0.0", "::1"} or
                    private_address or host.endswith((".internal", ".local", ".int", ".localhost"))):
                raise ValueError(f"{location}: non-public URL")


def validate_records(records, fields, key):
    identifiers = []
    for row in records:
        if set(row) != set(fields):
            raise ValueError(f"Unexpected {key} record fields")
        for field in fields:
            if field == "first_batch":
                if type(row[field]) is not bool:
                    raise ValueError("first_batch must be a boolean")
            elif not isinstance(row[field], str) or not row[field].strip():
                raise ValueError(f"Empty or non-text {key} field: {field}")
        identifiers.append(row[key])
    if not identifiers or len(identifiers) != len(set(identifiers)):
        raise ValueError(f"Empty records or duplicate {key} identifiers")
    return set(identifiers)


def compute_counts(catalog):
    return {
        "jokes": len(catalog["jokes"]),
        "mechanisms": len(catalog["mechanisms"]),
        "showcase": len(catalog["showcase"]),
        "first_batch": sum(row["first_batch"] for row in catalog["showcase"]),
        "usage": len(catalog["usage"]),
        "corpus_mechanism_labels": len({row["mechanism"] for row in catalog["jokes"]}),
        "retrieved_source_rows": len({source_id for row in catalog["usage"]
                                      for source_id in row["retrieved_source_ids"]}),
    }


def validate_catalog(catalog):
    if set(catalog) != {"meta", "jokes", "mechanisms", "showcase", "usage"}:
        raise ValueError("Unexpected public catalog sections")
    known_jokes = validate_records(catalog["jokes"], JOKE_FIELDS, "id")
    validate_records(catalog["mechanisms"], MECHANISM_FIELDS, "name")
    showcase_ids = validate_records(catalog["showcase"], SHOWCASE_FIELDS, "id")
    showcase = {row["id"]: row for row in catalog["showcase"]}
    usage_ids = []
    for row in catalog["usage"]:
        if set(row) != set(USAGE_FIELDS):
            raise ValueError("Unexpected usage record fields")
        usage_ids.append(row["id"])
        displayed = showcase.get(row["id"])
        if not displayed or (row["headline"], row["final_joke"]) != (displayed["headline"], displayed["text"]):
            raise ValueError("Usage and finalized showcase text do not match")
        retrieved = row["retrieved_source_ids"]
        if not isinstance(retrieved, list) or len(retrieved) != 4 or len(set(retrieved)) != 4:
            raise ValueError("Each recorded retrieval must contain four distinct source IDs")
        if not set(retrieved) <= known_jokes:
            raise ValueError("Recorded retrieval references an unknown source ID")
        for stage in ("planner", "writer"):
            if set(row[stage]) != set(STAGE_FIELDS) or any(
                    not isinstance(row[stage][field], str) or not row[stage][field].strip()
                    for field in STAGE_FIELDS):
                raise ValueError(f"Missing recorded {stage} prompt content")
    if len(usage_ids) != len(set(usage_ids)) or set(usage_ids) != showcase_ids:
        raise ValueError("Usage must cover the showcase IDs exactly once")
    if catalog["meta"]["counts"] != compute_counts(catalog):
        raise ValueError("Catalog counts do not match its records")
    if not all(catalog["meta"].get(key) for key in ("title", "language", "batch", "model", "provenance")):
        raise ValueError("Missing public catalog metadata")
    validate_public_strings(catalog)


def json_bytes(value):
    # Keep original text when decoded; also safe if JSON is ever embedded in HTML.
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    for character, replacement in (("<", "\\u003c"), (">", "\\u003e"),
                                   ("&", "\\u0026"), ("\u2028", "\\u2028"),
                                   ("\u2029", "\\u2029")):
        text = text.replace(character, replacement)
    return text.encode("utf-8")


def delimited_bytes(records, fields, delimiter):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, delimiter=delimiter, lineterminator="\n")
    writer.writeheader()
    for record in records:
        row = dict(record)
        if "first_batch" in row:
            row["first_batch"] = "true" if row["first_batch"] else "false"
        writer.writerow(row)
    return output.getvalue().encode("utf-8")


def build_outputs(catalog):
    outputs = {CATALOG: json_bytes(catalog)}
    destination = ROOT / "site/downloads"
    batches = {
        "jokes": (catalog["jokes"], JOKE_FIELDS),
        "showcase-full": (catalog["showcase"], SHOWCASE_FIELDS),
        "showcase-first-batch": ([row for row in catalog["showcase"] if row["first_batch"]], SHOWCASE_FIELDS),
    }
    for name, (records, fields) in batches.items():
        for extension, delimiter in (("csv", ","), ("tsv", "\t")):
            outputs[destination / f"{name}.{extension}"] = delimited_bytes(records, fields, delimiter)
    outputs[destination / "mechanisms.json"] = json_bytes(catalog["mechanisms"])
    outputs[destination / "headlines-template.csv"] = delimited_bytes(
        [{"id": "example_001", "headline": "Univerzitná knižnica predlžuje otváracie hodiny", "word1": "-", "word2": "-"}],
        ("id", "headline", "word1", "word2"), ",",
    )
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate generated files without writing them")
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    catalog["jokes"] = read_jokes()
    catalog["mechanisms"] = read_mechanisms()
    catalog["meta"]["counts"] = compute_counts(catalog)
    validate_catalog(catalog)
    outputs = build_outputs(catalog)
    stale = [path.relative_to(ROOT).as_posix() for path, data in outputs.items()
             if not path.exists() or path.read_bytes() != data]
    if args.check and stale:
        parser.exit(1, "Generated site data is stale: " + ", ".join(stale) + "\n")
    if not args.check:
        for path, data in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    counts = catalog["meta"]["counts"]
    print(f"Validated {counts['jokes']} jokes, {counts['mechanisms']} reference mechanisms, "
          f"{counts['showcase']} showcase entries, {counts['first_batch']} first-batch entries, "
          f"and {counts['usage']} recorded prompt examples; {len(outputs) - 1} downloads.")


if __name__ == "__main__":
    main()
