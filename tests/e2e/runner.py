#!/usr/bin/env python3
"""Cross-platform Python wrapper for Panopticon E2E Test Suite.
Executes Node.js E2E test runner (tests/e2e/runner.js).
"""
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNNER_JS = HERE / "runner.js"


def main():
    args = sys.argv[1:]
    node_cmd = ["node", str(RUNNER_JS)] + args
    print(f"[*] Panopticon E2E Runner launching: {' '.join(node_cmd)}")
    result = subprocess.run(node_cmd)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
