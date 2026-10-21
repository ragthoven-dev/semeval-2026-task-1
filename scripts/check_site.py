#!/usr/bin/env python3
"""Check the published snapshot, downloads, and static entry point."""

import csv
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_table(path, delimiter):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, delimiter=delimiter))


def unique_records(rows, key, label):
    require(rows, f"{label}: no records")
    values = [row[key] for row in rows]
    require(all(isinstance(value, str) and value.strip() for value in values),
            f"{label}: empty identifier")
    require(len(values) == len(set(values)), f"{label}: duplicate identifiers")


class EntryPoint(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.ids = []
        self.meta = set()
        self.language = None
        self.has_title = False

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if "id" in attributes:
            self.ids.append(attributes["id"])
        if tag == "html":
            self.language = attributes.get("lang")
        if tag == "title":
            self.has_title = True
        if tag == "meta":
            self.meta.add(attributes.get("name"))
        for name in ("href", "src"):
            if name in attributes:
                self.references.append(attributes[name])


def main():
    data = json.loads((SITE / "data/catalog.json").read_text(encoding="utf-8"))
    jokes, mechanisms = data["jokes"], data["mechanisms"]
    showcase, usage = data["showcase"], data["usage"]
    for records, key, label in (
        (jokes, "id", "jokes"), (mechanisms, "name", "mechanisms"),
        (showcase, "id", "showcase"), (usage, "id", "recorded retrievals"),
    ):
        unique_records(records, key, label)
    require(jokes == read_table(ROOT / "data/jokes/joke_summaries.tsv", "\t"),
            "Published joke corpus differs from the repository source")
    for joke in jokes:
        require(all(joke.get(key) for key in ("joke", "summary", "mechanism", "topic")),
                "Joke corpus has missing fields")
        source = urlsplit(joke["source"])
        require(source.scheme == "https" and source.netloc, "Invalid joke source URL")
    for mechanism in mechanisms:
        require(all(mechanism.get(key) for key in ("name", "desc", "ex1", "ex2")),
                "Mechanism catalog has missing definitions or examples")
    joke_ids = {row["id"] for row in jokes}
    showcase_by_id = {row["id"]: row for row in showcase}
    require(set(showcase_by_id) == {row["id"] for row in usage},
            "Recorded retrievals and showcase IDs differ")
    for record in usage:
        selected = record["retrieved_source_ids"]
        require(len(selected) == 4 and len(set(selected)) == 4,
                "A recorded headline does not have four distinct source examples")
        require(set(selected) <= joke_ids, "A retrieval refers to an unknown source joke")
        final = showcase_by_id[record["id"]]
        require(record["headline"] == final["headline"] and record["final_joke"] == final["text"],
                "Recorded headline/final joke is out of sync with the showcase")
        for stage in ("planner", "writer"):
            require(all(record[stage].get(key) for key in
                        ("inspiration", "system_prompt", "user_prompt")),
                    f"Missing recorded {stage} prompt")
    for record in showcase:
        require(type(record["first_batch"]) is bool, "Invalid first-batch membership")
        require(record["text"].strip() and ";" not in record["text"],
                "Showcase contains an empty joke or a semicolon")
        tokens = lambda text: set(re.findall(r"[^\W_]+", text.casefold()))
        anchors = {token for token in tokens(record["headline"]) if len(token) >= 4}
        require(anchors & tokens(record["text"]), "A showcase joke lost its headline anchor")
    first_batch = [record for record in showcase if record["first_batch"]]
    require(first_batch, "No first-batch examples")
    for filename, expected in (
        ("jokes", jokes),
        ("showcase-full", [{"id": row["id"], "headline": row["headline"], "text": row["text"],
                            "first_batch": str(row["first_batch"]).lower()} for row in showcase]),
        ("showcase-first-batch", [{"id": row["id"], "headline": row["headline"], "text": row["text"],
                                   "first_batch": "true"} for row in first_batch]),
    ):
        for suffix, delimiter in (("csv", ","), ("tsv", "\t")):
            require(read_table(SITE / "downloads" / f"{filename}.{suffix}", delimiter) == expected,
                    f"Download {filename}.{suffix} does not match the published data")
    require(json.loads((SITE / "downloads/mechanisms.json").read_text()) == mechanisms,
            "Mechanism download differs from the displayed catalog")
    template = read_table(SITE / "downloads/headlines-template.csv", ",")
    require(template and all(set(row) == {"id", "headline", "word1", "word2"} for row in template),
            "Headline template has the wrong columns")

    entry = EntryPoint()
    entry.feed((SITE / "index.html").read_text(encoding="utf-8"))
    require(entry.language and entry.has_title and {"viewport", "description"} <= entry.meta,
            "Entry point lacks its language, title, viewport, or description")
    require(len(entry.ids) == len(set(entry.ids)), "Entry point has duplicate HTML IDs")
    for reference in entry.references:
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc or not parsed.path:
            require(parsed.scheme != "file", "Public page contains a local-file link")
            continue
        require(not parsed.path.startswith("/"),
                "Root-relative asset/link would break the GitHub Pages project path")
        target = (SITE / unquote(parsed.path)).resolve()
        require(target.is_relative_to(SITE) and target.is_file(),
                f"Missing or out-of-site relative reference: {parsed.path}")
    private_patterns = re.compile(
        r"/Users/|/home/|file://|llm-proxy\.|\.int\.infra\.|x-cisco-app|"
        r"sk-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
    )
    for path in SITE.rglob("*"):
        require(not path.is_symlink(), f"Website contains a symlink: {path.relative_to(SITE)}")
        if not path.is_file():
            continue
        if path.suffix in {".html", ".js", ".css", ".json", ".csv", ".tsv", ".md", ".svg"}:
            require(not private_patterns.search(path.read_text(encoding="utf-8-sig")),
                    f"Private/local content in {path.relative_to(SITE)}")
    print(f"Website checks passed: {len(showcase)} showcase jokes, "
          f"{len(first_batch)} first-batch jokes, {len(jokes)} source jokes, "
          f"{len(mechanisms)} mechanisms, {len(usage)} recorded retrievals.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, KeyError, ValueError, TypeError) as error:
        print(f"Website check failed: {error}", file=sys.stderr)
        raise SystemExit(1)
