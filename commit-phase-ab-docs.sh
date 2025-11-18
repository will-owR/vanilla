#!/bin/bash

# Phase A-B Documentation Reorganization Commit
# This script stages and commits the planning document reorganization

cd /workspaces/vanilla

echo "=== Phase A-B Documentation Reorganization ==="
echo ""

# Stage all changes
echo "Staging changes..."
git add -A

# Show what will be committed
echo ""
echo "Changes to be committed:"
git diff --cached --name-status

# Commit with descriptive message
echo ""
echo "Committing..."
git commit -m "docs: reorganize Phase A-B planning documents into phaseAB and phaseAB_prep folders

- Move architecture docs (ORCHESTRATOR, BACKEND_MODULARITY, FRONTEND_BACKEND_INTEGRATION) to phaseAB_prep/
- Move implementation status and integration checklist to phaseAB/
- Create executive summaries (STRATEGIC_CONTEXT, PARALLEL_ROADMAP, QUICK_REFERENCE) in docs/design/
- Complete documentation ready for team distribution and implementation kickoff

Status: 🟢 Ready for Checkpoint 0 (alignment kickoff)"

# Push to origin
echo ""
echo "Pushing to origin..."
git push origin aetherV0/anew-default-demo

echo ""
echo "=== Commit Complete ==="
echo "All Phase A-B planning documents committed and pushed to origin"
