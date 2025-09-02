#!/bin/bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${BLUE}Building processor for iOS...${NC}"

export CARGO_TARGET_DIR=./dist/target

# TODO this should be some other NX step?
TARGETS=("aarch64-apple-ios" "aarch64-apple-ios-sim")

for TARGET in "${TARGETS[@]}"; do
  if ! rustup target list --installed | grep -q "$TARGET"; then
    echo -e "${BLUE}Installing Rust target: $TARGET${NC}"
    rustup target add "$TARGET"
  fi

  echo -e "${BLUE}Building for target: $TARGET${NC}"
  cargo build --manifest-path Cargo.toml --target "$TARGET" --release
done

cp dist/target/aarch64-apple-ios/release/libprocessor.a dist/libprocessor-ios.a
cp dist/target/aarch64-apple-ios-sim/release/libprocessor.a dist/libprocessor-ios-sim.a

# Generate header
cbindgen --config cbindgen.toml --crate processor --output dist/processor.h

echo -e "${GREEN}Done.${NC}"
