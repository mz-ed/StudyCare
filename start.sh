#!/bin/bash
# StudyCare Startup Script
# Sets up all portable environment variables for this project

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export RUSTUP_HOME="$PROJECT_ROOT/.rustup"
export CARGO_HOME="$PROJECT_ROOT/.cargo"
export NVM_DIR="$PROJECT_ROOT/.nvm"
export PATH="$CARGO_HOME/bin:$PATH"

# Load nvm if available
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "======================================"
echo "  StudyCare - Medical Study Tracker"
echo "======================================"
echo "  Rust:  $(rustc -V 2>/dev/null || echo 'NOT FOUND')"
echo "  Node:  $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "  pnpm:  $(pnpm -v 2>/dev/null || echo 'NOT FOUND')"
echo "======================================"

cd "$PROJECT_ROOT/timeapp"

case "${1:-dev}" in
    dev)
        echo "Starting development mode..."
        pnpm tauri dev
        ;;
    build-linux)
        echo "Building Linux binary..."
        pnpm tauri build
        ;;
    build-windows)
        echo "Building Windows installer (experimental, requires cargo-xwin)..."
        pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
        ;;
    dev-frontend)
        echo "Starting frontend only (Vite)..."
        pnpm dev
        ;;
    *|help)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  dev             Start development mode (default)"
        echo "  build-linux     Build Linux binary"
        echo "  build-windows   Build Windows .exe installer"
        echo "  dev-frontend    Frontend only (Vite dev server)"
        echo "  help            Show this help"
        ;;
esac