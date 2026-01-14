#!/bin/bash
# Generate a new build ID from current timestamp
BUILD_ID=$(date +%s | shasum -a 256 | head -c 6)
echo "export const BUILD_ID = '$BUILD_ID';" > src/build-id.ts
