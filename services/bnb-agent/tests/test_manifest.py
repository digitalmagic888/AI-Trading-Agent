import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from manifest import build_manifest


class ManifestTests(unittest.TestCase):
    def test_manifest_has_required_capabilities(self):
        manifest = build_manifest()
        self.assertEqual(manifest["name"], "TriStack Alpha Agent")
        self.assertIn("flash-liquidity-opportunity-scoring", manifest["capabilities"])
        self.assertTrue(manifest["dry_run_default"])


if __name__ == "__main__":
    unittest.main()
