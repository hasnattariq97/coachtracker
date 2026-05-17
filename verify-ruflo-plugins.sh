#!/bin/bash

echo "Verifying Ruflo Plugin Installation"
echo "===================================="
echo ""

echo "Global npm packages installed:"
echo "------------------------------"
npm list -g --depth=0 2>/dev/null | grep -E "agentdb|@claude-flow|ruflo" || echo "Checking..."

echo ""
echo "Checking individual plugins:"
echo "------------------------------"

plugins=(
  "agentdb"
  "@claude-flow/memory"
  "@claude-flow/intelligence"
  "@claude-flow/swarm"
  "@claude-flow/autopilot"
  "@claude-flow/goals"
  "@claude-flow/workflows"
  "@claude-flow/testgen"
  "@claude-flow/docs"
  "@claude-flow/security"
  "@claude-flow/observability"
  "@claude-flow/federation"
  "@claude-flow/cost-tracker"
)

for plugin in "${plugins[@]}"; do
  if npm list -g "$plugin" >/dev/null 2>&1; then
    echo "✅ $plugin"
  else
    echo "❌ $plugin"
  fi
done

echo ""
echo "Verifying Ruflo commands:"
echo "------------------------------"

if command -v ruflo &> /dev/null; then
  echo "✅ ruflo command available"
  ruflo --version
else
  echo "❌ ruflo command not found"
fi

if command -v claude-flow &> /dev/null; then
  echo "✅ claude-flow command available"
else
  echo "❌ claude-flow command not found"
fi

echo ""
echo "Verifying Ruflo configuration:"
echo "------------------------------"

if [ -d "~/.ruflo" ]; then
  echo "✅ ~/.ruflo directory exists"
  ls -la ~/.ruflo | head -5
else
  echo "⚠️  ~/.ruflo directory not found (will be created on first run)"
fi

if [ -f "ruvector.db" ]; then
  echo "✅ ruvector.db exists ($(ls -lh ruvector.db | awk '{print $5}'))"
else
  echo "❌ ruvector.db not found"
fi

echo ""
echo "Running Ruflo diagnostics:"
echo "------------------------------"

npx ruflo@latest init --doctor 2>&1 | tail -20

echo ""
echo "Verification complete!"
