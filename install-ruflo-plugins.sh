#!/bin/bash

# Wait for global ruflo installation to complete
echo "Waiting for Ruflo global installation..."
sleep 15

# Ensure npm is in PATH
export PATH="/c/Program Files/nodejs:$PATH"

echo "Installing 13 Ruflo Plugins..."
echo "================================"

# Memory & Knowledge (3)
echo "1/13: Installing ruflo-agentdb..."
ruflo plugins install -n ruflo-agentdb || npx ruflo@latest plugins install -n ruflo-agentdb
sleep 2

echo "2/13: Installing ruflo-rag-memory..."
ruflo plugins install -n ruflo-rag-memory || npx ruflo@latest plugins install -n ruflo-rag-memory
sleep 2

echo "3/13: Installing ruflo-intelligence..."
ruflo plugins install -n ruflo-intelligence || npx ruflo@latest plugins install -n ruflo-intelligence
sleep 2

# Orchestration (4)
echo "4/13: Installing ruflo-swarm..."
ruflo plugins install -n ruflo-swarm || npx ruflo@latest plugins install -n ruflo-swarm
sleep 2

echo "5/13: Installing ruflo-autopilot..."
ruflo plugins install -n ruflo-autopilot || npx ruflo@latest plugins install -n ruflo-autopilot
sleep 2

echo "6/13: Installing ruflo-goals..."
ruflo plugins install -n ruflo-goals || npx ruflo@latest plugins install -n ruflo-goals
sleep 2

echo "7/13: Installing ruflo-workflows..."
ruflo plugins install -n ruflo-workflows || npx ruflo@latest plugins install -n ruflo-workflows
sleep 2

# Code Quality (4)
echo "8/13: Installing ruflo-testgen..."
ruflo plugins install -n ruflo-testgen || npx ruflo@latest plugins install -n ruflo-testgen
sleep 2

echo "9/13: Installing ruflo-docs..."
ruflo plugins install -n ruflo-docs || npx ruflo@latest plugins install -n ruflo-docs
sleep 2

echo "10/13: Installing ruflo-security-audit..."
ruflo plugins install -n ruflo-security-audit || npx ruflo@latest plugins install -n ruflo-security-audit
sleep 2

echo "11/13: Installing ruflo-observability..."
ruflo plugins install -n ruflo-observability || npx ruflo@latest plugins install -n ruflo-observability
sleep 2

# Enterprise (2)
echo "12/13: Installing ruflo-federation..."
ruflo plugins install -n ruflo-federation || npx ruflo@latest plugins install -n ruflo-federation
sleep 2

echo "13/13: Installing ruflo-cost-tracker..."
ruflo plugins install -n ruflo-cost-tracker || npx ruflo@latest plugins install -n ruflo-cost-tracker

echo ""
echo "================================"
echo "Plugin installation complete!"
echo ""
echo "Running final setup..."
echo "Re-bootstrapping Ruflo intelligence..."
ruflo hooks pretrain --depth deep || npx ruflo@latest hooks pretrain --depth deep

echo ""
echo "Verifying installation..."
ruflo init --doctor || npx ruflo@latest init --doctor

echo ""
echo "✅ Full Ruflo setup complete!"
