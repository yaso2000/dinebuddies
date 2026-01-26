#!/bin/bash
# Vercel build script with proper permissions

# Install dependencies with legacy peer deps
npm install --legacy-peer-deps

# Make vite executable
chmod +x node_modules/.bin/vite

# Run build
npm run build
