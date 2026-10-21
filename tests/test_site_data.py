"""Public-release checks for accidental private data and broken trace links."""

import copy
import importlib.util
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_site_data", ROOT / "scripts/build_site_data.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class PublicSiteDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / "site/data/catalog.json").read_text(encoding="utf-8"))

    def test_snapshot_is_valid_and_refresh_preserves_source_text(self):
        BUILDER.validate_catalog(self.catalog)
        self.assertEqual(self.catalog["jokes"], BUILDER.read_jokes())
        self.assertEqual(self.catalog["mechanisms"], BUILDER.read_mechanisms())

    def test_private_request_metadata_cannot_be_published(self):
        for field, value in (("api_key", "example-token"), ("base_url", "https://example.com")):
            with self.subTest(field=field):
                catalog = copy.deepcopy(self.catalog)
                catalog["meta"][field] = value
                with self.assertRaises(ValueError):
                    BUILDER.validate_catalog(catalog)

    def test_local_and_credential_urls_cannot_be_published(self):
        for value in (
            "/Users/example/private-run.json",
            "http://localhost:8000/",
            "http://192.168.1.10/model",
            "https://user:password@example.com/",
            "https://service.internal/model",
        ):
            with self.subTest(value=value):
                catalog = copy.deepcopy(self.catalog)
                catalog["meta"]["provenance"]["unapproved"] = value
                with self.assertRaises(ValueError):
                    BUILDER.validate_catalog(catalog)

    def test_prompt_html_payloads_are_rejected(self):
        catalog = copy.deepcopy(self.catalog)
        catalog["usage"][0]["planner"]["inspiration"] = '<img src="x" onerror="alert(1)">'
        with self.assertRaises(ValueError):
            BUILDER.validate_catalog(catalog)

    def test_retrieval_must_point_to_four_known_distinct_jokes(self):
        for ids in (("unknown", "j0001", "j0002", "j0003"), ("j0001",) * 4):
            with self.subTest(ids=ids):
                catalog = copy.deepcopy(self.catalog)
                catalog["usage"][0]["retrieved_source_ids"] = list(ids)
                with self.assertRaises(ValueError):
                    BUILDER.validate_catalog(catalog)

    def test_download_and_example_text_cannot_silently_diverge(self):
        catalog = copy.deepcopy(self.catalog)
        catalog["usage"][0]["final_joke"] = "A stale example."
        with self.assertRaises(ValueError):
            BUILDER.validate_catalog(catalog)


if __name__ == "__main__":
    unittest.main()
