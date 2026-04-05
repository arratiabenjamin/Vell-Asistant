#!/usr/bin/env bash
set -euo pipefail

echo "== Forge GUI / Rust setup (macOS) =="

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este script es solo para macOS."
  exit 1
fi

if ! command -v xcode-select >/dev/null 2>&1; then
  echo "xcode-select no existe. Instalá Xcode Command Line Tools primero."
  exit 1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Instalando Command Line Tools..."
  xcode-select --install || true
  echo "Completá la instalación y ejecutá de nuevo."
  exit 1
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "Instalando rustup + Rust estable..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
else
  echo "rustup ya instalado."
fi

if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
fi

rustup default stable
rustup update stable

echo
echo "Versiones instaladas:"
rustc --version
cargo --version

echo
echo "Siguiente paso:"
echo "  pnpm doctor:gui"
echo "  pnpm dev:daemon"
echo "  pnpm dev:gui"
