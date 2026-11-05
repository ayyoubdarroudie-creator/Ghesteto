#!/usr/bin/env bash
# One-time helper: creates YOUR private signing key and prints what to put in GitHub Secrets.
# Needs a JDK (keytool). Keep the generated file and the passwords somewhere safe: without them you can never update the app.
set -euo pipefail
FILE="${1:-my-release.keystore}"
ALIAS="${2:-aghsat}"
if [ -e "$FILE" ]; then echo "$FILE already exists. Choose another name."; exit 1; fi
keytool -genkeypair -v -keystore "$FILE" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10950
echo
echo "Done. Now add these 4 repository secrets (Settings > Secrets and variables > Actions):"
echo "  ANDROID_KEYSTORE_BASE64   = $(base64 -w0 "$FILE" 2>/dev/null | cut -c1-24)...  (full value is in $FILE.b64)"
base64 -w0 "$FILE" > "$FILE.b64" 2>/dev/null || base64 "$FILE" | tr -d '\n' > "$FILE.b64"
echo "  ANDROID_KEYSTORE_PASSWORD = the keystore password you just typed"
echo "  ANDROID_KEY_ALIAS         = $ALIAS"
echo "  ANDROID_KEY_PASSWORD      = the key password (leave empty if it is the same)"
