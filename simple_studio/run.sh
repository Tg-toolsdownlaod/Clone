#!/bin/bash
# Convenient runner for macOS/Linux — reuses the main project's .venv
cd "$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f ".venv/bin/python" ]; then
  echo "[ERROR] រកមិនឃើញ .venv ទេ។ សូមរត់ run_mac.sh ឬ install_mac.sh នៅ Folder ចម្បងជាមុនសិន ដើម្បីដំឡើង Dependencies។"
  exit 1
fi

echo "===================================================="
echo "🎬 កំពុងចាប់ផ្តើម KhmerDub AI (Simple) — http://localhost:4000"
echo "===================================================="
.venv/bin/python simple_studio/server.py
