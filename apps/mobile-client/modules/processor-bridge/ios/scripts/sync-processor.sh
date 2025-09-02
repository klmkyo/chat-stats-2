#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$MODULE_IOS_DIR/../../../../.." && pwd)"

SRC_DIR="$ROOT_DIR/libs/processor/dist"
DEST_DIR="$MODULE_IOS_DIR/Vendored/Processor"

mkdir -p "$DEST_DIR"

rm -rf "$DEST_DIR/Processor.xcframework"

cp -R "$SRC_DIR/Processor.xcframework" "$DEST_DIR/Processor.xcframework"

echo "Synced processor artifacts to $DEST_DIR"


