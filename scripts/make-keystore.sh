#!/usr/bin/env bash
# One-time helper: creates YOUR private signing key and the text value you paste into GitHub Secrets.
# Usage: bash scripts/make-keystore.sh [file-name] [alias]
# Needs a JDK (the "keytool" program). If you do not want to install Java, use the
# "Create signing key" workflow in GitHub instead (see README).
set -euo pipefail

FILE="${1:-my-release.keystore}"
ALIAS="${2:-aghsat}"

find_keytool() {
  if command -v keytool >/dev/null 2>&1; then command -v keytool; return 0; fi
  local c h
  for c in \
    "${JAVA_HOME:-/nonexistent}/bin/keytool" "${JAVA_HOME:-/nonexistent}/bin/keytool.exe" \
    "/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe" \
    "/c/Program Files/Android/Android Studio/jre/bin/keytool.exe" \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" \
    /c/Program\ Files/Eclipse\ Adoptium/*/bin/keytool.exe \
    /c/Program\ Files/Java/*/bin/keytool.exe \
    /c/Program\ Files/Microsoft/jdk-*/bin/keytool.exe \
    /usr/lib/jvm/*/bin/keytool; do
    if [ -x "$c" ]; then echo "$c"; return 0; fi
  done
  if [ -x /usr/libexec/java_home ]; then
    h="$(/usr/libexec/java_home 2>/dev/null || true)"
    if [ -n "$h" ] && [ -x "$h/bin/keytool" ]; then echo "$h/bin/keytool"; return 0; fi
  fi
  return 1
}

if ! KEYTOOL="$(find_keytool)"; then
  cat <<'MSG'
keytool (part of Java / JDK) was not found on this computer.

Fix it in one of these ways:
  Windows : install "Temurin 17 (JDK)" from https://adoptium.net  (tick "Add to PATH" in the installer),
            then close and reopen Git Bash / the terminal.
  macOS   : brew install --cask temurin@17
  Ubuntu  : sudo apt install openjdk-17-jdk-headless
  No install at all: use the GitHub workflow "Create signing key" (README, private repositories only).

Then run this script again.
MSG
  exit 1
fi
echo "Using: $KEYTOOL"

if [ -e "$FILE" ]; then echo "$FILE already exists. Choose another name."; exit 1; fi

EXTRA=()
if [ -n "${KS_PASS:-}" ]; then   # non-interactive mode (used for tests / automation)
  EXTRA=(-storepass "$KS_PASS" -keypass "$KS_PASS" -dname "${KS_DNAME:-CN=Aghsat, C=IR}")
fi
"$KEYTOOL" -genkeypair -v -keystore "$FILE" -storetype PKCS12 -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10950 "${EXTRA[@]}"

# one-line base64 text of the keystore (works on Windows Git Bash, macOS and Linux)
base64 "$FILE" | tr -d '\r\n' > "$FILE.b64"

cat <<MSG

Done. Created:
  $FILE        <- KEEP THIS SAFE (two copies), never put it in the repository
  $FILE.b64    <- the text you paste into the ANDROID_KEYSTORE_BASE64 secret

Add these 4 secrets (GitHub > Settings > Secrets and variables > Actions):
  ANDROID_KEYSTORE_BASE64   = the whole content of $FILE.b64
  ANDROID_KEYSTORE_PASSWORD = the keystore password you typed
  ANDROID_KEY_ALIAS         = $ALIAS
  ANDROID_KEY_PASSWORD      = the key password (do not create this secret if you pressed Enter = same password)
MSG
