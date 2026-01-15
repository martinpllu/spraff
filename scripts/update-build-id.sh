#!/bin/bash
# Generate a 6-character build ID from current timestamp
BUILD_ID=$(date +%s | shasum -a 256 | head -c 6)

# Write to src/build-id.ts
cat > "$(dirname "$0")/../src/build-id.ts" << EOF
// Auto-generated - do not edit manually
export const BUILD_ID = '${BUILD_ID}';
EOF

echo "Build ID updated to: ${BUILD_ID}"
