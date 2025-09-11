#!/bin/bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${BLUE}Building processor for iOS...${NC}"

export CARGO_TARGET_DIR=./dist/target

mkdir -p dist/generated/include

if [ ! -f "dist/generated/include/processor.h" ] || [ "src/lib.rs" -nt "dist/generated/include/processor.h" ]; then
  echo -e "${BLUE}Generating C headers...${NC}"
  cbindgen --config cbindgen.toml --crate processor --output dist/generated/include/processor.h
fi

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

# clean previous xcframework
rm -rf dist/Processor.xcframework

IOS_LIB="dist/target/aarch64-apple-ios/release/libprocessor.a"
IOS_SIM_LIB="dist/target/aarch64-apple-ios-sim/release/libprocessor.a"

xcodebuild -create-xcframework \
  -library "$IOS_LIB" -headers dist/generated/include \
  -library "$IOS_SIM_LIB" -headers dist/generated/include \
  -output dist/Processor.xcframework

# Print the human-readable size of the non-simulator (device) static library
if [ -f "$IOS_LIB" ]; then
  SIZE_HUMAN=$(du -h "$IOS_LIB" | cut -f1)
  echo -e "${BLUE}libprocessor.a (device) size: ${SIZE_BYTES} bytes (${SIZE_HUMAN})${NC}"
else
  echo -e "${BLUE}libprocessor.a (device) not found!${NC}"
fi

echo -e "${GREEN}Done.${NC}"
