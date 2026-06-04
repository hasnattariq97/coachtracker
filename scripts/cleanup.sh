#!/bin/bash
# Cleanup script for Coach Task Tracker - kills stuck Node processes
# Usage: ./scripts/cleanup.sh

echo ""
echo "======================================"
echo " Coach Task Tracker - System Cleanup"
echo "======================================"
echo ""

# Count Node processes
echo "[1/4] Checking for Node processes..."
node_count=$(ps aux | grep node | grep -v grep | wc -l)

if [ $node_count -eq 0 ]; then
    echo "      ✓ No Node processes running"
else
    echo "      ⚠  Found $node_count Node process(es)"
    echo "      Killing all Node processes..."

    # Try killall first, then pkill
    killall -9 node 2>/dev/null || pkill -9 node 2>/dev/null || true

    if [ $? -eq 0 ]; then
        echo "      ✓ Node processes terminated"
    else
        echo "      ⚠  Some processes may not have terminated"
    fi
fi

echo ""
echo "[2/4] Waiting for cleanup (3 seconds)..."
sleep 3

echo ""
echo "[3/4] Verifying cleanup..."
node_count=$(ps aux | grep node | grep -v grep | wc -l)
if [ $node_count -eq 0 ]; then
    echo "      ✓ All Node processes cleaned"
else
    echo "      ⚠  $node_count process(es) still running (may need system restart)"
fi

echo ""
echo "[4/4] Summary"
echo "      • Port 3001: Backend (must be restarted manually)"
echo "      • Port 5173: Frontend (must be restarted manually)"
echo "      • Database: server/tracker.db (untouched)"
echo ""
echo "======================================"
echo " ✓ Cleanup complete"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Open new terminal: cd d:/Cursor_new/server && node index.js"
echo "  2. Open another terminal: cd d:/Cursor_new/client && npm run dev"
echo "  3. Visit http://localhost:5173"
echo ""
