#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🦀 Building Rust processor library for iOS...${NC}"

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"

# Invoke the processor-owned build target (keeps ownership and caching in the processor project)
pnpm nx run processor:build-ios --skip-nx-cache

# Create the iOS bridge directory structure
BRIDGE_IOS_DIR="../processor-bridge/ios"
mkdir -p "$BRIDGE_IOS_DIR/lib"
mkdir -p "$BRIDGE_IOS_DIR/include"

# Copy the static libraries from processor dist
echo -e "${BLUE}Copying static libraries...${NC}"
cp "$ROOT_DIR/dist/target/aarch64-apple-ios/release/libprocessor.a" "$BRIDGE_IOS_DIR/lib/libprocessor-ios.a"

if [ -f "$ROOT_DIR/dist/target/aarch64-apple-ios-sim/release/libprocessor.a" ]; then
    cp "$ROOT_DIR/dist/target/aarch64-apple-ios-sim/release/libprocessor.a" "$BRIDGE_IOS_DIR/lib/libprocessor-sim.a"
fi

# Copy the header file
echo -e "${BLUE}Copying header file...${NC}"
cp "$ROOT_DIR/libs/processor/dist/ios/include/processor.h" "$BRIDGE_IOS_DIR/include/"

echo -e "${GREEN}✅ Rust library built and configured for iOS!${NC}"

# Navigate back to the bridge directory
cd "$BRIDGE_IOS_DIR"
