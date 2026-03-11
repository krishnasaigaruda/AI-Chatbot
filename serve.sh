#!/bin/bash
echo "Starting local server at http://localhost:8000"
echo "Open this URL in Chrome or Edge (WebGPU required)"
echo ""
python3 -m http.server 8000
