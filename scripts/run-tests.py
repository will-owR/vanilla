#!/usr/bin/env python3
"""Run tests and report results"""

import subprocess
import sys
import os

os.chdir('/workspaces/vanilla/server')

print("Running tests in /workspaces/vanilla/server...")
print("=" * 60)

result = subprocess.run(
    ['npm', 'run', 'test:run'],
    capture_output=True,
    text=True
)

print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr)

print("=" * 60)
print(f"Exit code: {result.returncode}")

if result.returncode == 0:
    print("✓ ALL TESTS PASSED!")
else:
    print("✗ Tests failed - see output above")

sys.exit(result.returncode)
