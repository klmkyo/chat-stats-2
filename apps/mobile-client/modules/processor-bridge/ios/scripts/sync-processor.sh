#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$MODULE_IOS_DIR/../../../../.." && pwd)"

SRC_DIR="$ROOT_DIR/libs/processor/dist"
DEST_DIR="$MODULE_IOS_DIR/Vendored/Processor"

mkdir -p "$DEST_DIR"

cp -f "$SRC_DIR/processor.h" "$DEST_DIR/processor.h"
cp -f "$SRC_DIR/libprocessor-ios.a" "$DEST_DIR/libprocessor-ios.a"
cp -f "$SRC_DIR/libprocessor-ios-sim.a" "$DEST_DIR/libprocessor-ios-sim.a"

echo "Synced processor artifacts to $DEST_DIR"


