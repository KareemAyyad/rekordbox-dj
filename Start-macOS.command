#!/bin/bash
# Move to the project directory
cd "$(dirname "$0")/rekordbox"

echo "------------------------------------------"
echo "   DropCrate - DJ Library Tool Setup      "
echo "------------------------------------------"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Please download and install it from: https://nodejs.org/"
    read -p "Press enter to exit..."
    exit 1
fi

# Initial setup if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "[1/2] Installing dependencies (this may take a minute)..."
    npm install
else
    echo "[1/2] Dependencies already installed."
fi

echo "[2/2] Starting DropCrate..."
echo "------------------------------------------"
echo "The app will open at: http://localhost:8787"
echo "------------------------------------------"

# Ensure desktop is built if dist is missing
if [ ! -d "apps/desktop/dist" ]; then
    echo "First time setup: Building frontend assets..."
    npm run build:web
fi

npm run serve:web
