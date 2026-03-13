#!/bin/bash
# Patch expo/virtual/streams.js and web-streams-polyfill polyfill.js with no-op.
# Expo SDK 54 includes web-streams-polyfill as a prelude script that runs before
# Metro's module system. Babel's @babel/plugin-transform-runtime converts its
# inlined helpers to require("@babel/runtime/...") calls, which fail because no
# modules are registered yet. Expo Go has native ReadableStream, so a no-op is safe.
NOOP='(function(g){"use strict";})(typeof globalThis!=="undefined"?globalThis:typeof global!=="undefined"?global:typeof window!=="undefined"?window:this);'

for f in $(find node_modules/.pnpm -path "*/expo/virtual/streams.js" 2>/dev/null); do
  echo "$NOOP" > "$f"
  echo "Patched: $f"
done

for f in $(find node_modules/.pnpm -path "*/web-streams-polyfill@*/dist/polyfill.js" 2>/dev/null); do
  echo "$NOOP" > "$f"
  echo "Patched: $f"
done
