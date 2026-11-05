#!/usr/bin/env bash
# Aligns and signs the release APK, then refuses to continue if the result would be rejected by app stores.
#   STORE_BUILD=true  -> a private keystore (GitHub Secrets) is REQUIRED; the bundled sideload key is never used.
#   STORE_BUILD=false -> falls back to the bundled sideload key when no secrets are set (personal installs only).
set -euo pipefail

STORE_BUILD="${STORE_BUILD:-false}"
OUT_NAME="${OUT_NAME:-aghsat.apk}"
IN_APK="${IN_APK:-android/app/build/outputs/apk/release/app-release-unsigned.apk}"

TOOLS="${TOOLS_DIR:-}"
if [ -z "$TOOLS" ]; then
  BT="$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -n1)"
  TOOLS="$ANDROID_HOME/build-tools/$BT"
fi

if [ -n "${KEYSTORE_BASE64:-}" ]; then
  KS="${RUNNER_TEMP:-/tmp}/release.keystore"
  echo "$KEYSTORE_BASE64" | base64 -d > "$KS"
  KS_PASS="${KEYSTORE_PASSWORD:?ANDROID_KEYSTORE_PASSWORD secret is empty}"
  ALIAS="${KEY_ALIAS:?ANDROID_KEY_ALIAS secret is empty}"
  KEY_PASS="${KEY_PASSWORD:-$KEYSTORE_PASSWORD}"
  echo "Signing with YOUR keystore (alias: $ALIAS)."
else
  if [ "$STORE_BUILD" = "true" ]; then
    echo "::error::This is a store build (for_store = true) but no signing key was found. Add the four ANDROID_* secrets (see README) and run again. The bundled sideload key is NOT accepted by Cafe Bazaar / Google Play."
    exit 1
  fi
  KS="keystore/aghsat-sideload.keystore"; KS_PASS="aghsat-sideload"; ALIAS="aghsat"; KEY_PASS="aghsat-sideload"
  echo "Signing with the bundled SIDELOAD key (personal installs only, not for stores)."
fi

mkdir -p dist
OUT="dist/$OUT_NAME"
"$TOOLS/zipalign" -p -f 4 "$IN_APK" "dist/aligned.apk"
"$TOOLS/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --ks-key-alias "$ALIAS" --key-pass "pass:$KEY_PASS" --out "$OUT" "dist/aligned.apk"
rm -f dist/aligned.apk "$OUT.idsig"

echo "---- signature check ----"
CERTS="$("$TOOLS/apksigner" verify --print-certs "$OUT")"
echo "$CERTS"

if echo "$CERTS" | grep -qi "Android Debug"; then
  echo "::error::The APK is signed with an Android DEBUG certificate. Stores reject it."
  exit 1
fi
if [ "$STORE_BUILD" = "true" ] && echo "$CERTS" | grep -qi "Aghsat Sideload"; then
  echo "::error::The APK is signed with the bundled sideload key. Use your own keystore for stores."
  exit 1
fi
if "$TOOLS/aapt2" dump badging "$OUT" | grep -q "application-debuggable"; then
  echo "::error::The APK is marked debuggable. Stores reject it."
  exit 1
fi
echo "OK: $OUT"
