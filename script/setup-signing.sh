#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# Aplo — APK/AAB Signing Setup
# ═══════════════════════════════════════════════════════
# Run this on a machine with Java installed (server/CI)
# Generates: signing keystore + updates assetlinks.json
#
# Usage: bash script/setup-signing.sh
# ═══════════════════════════════════════════════════════

set -euo pipefail

KEYSTORE_DIR="signing"
KEYSTORE_FILE="$KEYSTORE_DIR/aplo-release.keystore"
ALIAS="aplo"
VALIDITY=10000  # ~27 years
ASSETLINKS="client/public/.well-known/assetlinks.json"

echo "═══════════════════════════════════════════"
echo "  Aplo — APK/AAB Signing Key Setup"
echo "═══════════════════════════════════════════"

# Check Java
if ! command -v keytool &>/dev/null; then
  echo "❌ Java keytool not found. Install Java JDK first:"
  echo "   sudo apt install default-jdk"
  exit 1
fi

mkdir -p "$KEYSTORE_DIR"

if [ -f "$KEYSTORE_FILE" ]; then
  echo "⚠️  Keystore already exists: $KEYSTORE_FILE"
  echo "   Delete it first if you want to regenerate."
else
  echo ""
  echo "📋 Generating release keystore..."
  echo "   You will be prompted for:"
  echo "   - Keystore password (remember this!)"
  echo "   - Your name, organization, country"
  echo ""

  keytool -genkeypair \
    -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity $VALIDITY \
    -storetype PKCS12

  echo ""
  echo "✅ Keystore created: $KEYSTORE_FILE"
fi

# Extract SHA-256 fingerprint
echo ""
echo "📋 Extracting SHA-256 fingerprint..."

FINGERPRINT=$(keytool -list -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$ALIAS" \
  2>/dev/null | grep "SHA256:" | sed 's/.*SHA256: //')

if [ -z "$FINGERPRINT" ]; then
  echo "⚠️  Could not auto-extract fingerprint. Run manually:"
  echo "   keytool -list -v -keystore $KEYSTORE_FILE -alias $ALIAS"
  echo "   Copy the SHA256 fingerprint line."
else
  echo "   SHA-256: $FINGERPRINT"

  # Update assetlinks.json
  if [ -f "$ASSETLINKS" ]; then
    sed -i "s|__SIGNING_KEY_SHA256_FINGERPRINT__|$FINGERPRINT|g" "$ASSETLINKS"
    echo ""
    echo "✅ Updated $ASSETLINKS with fingerprint"
  fi
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Signing setup complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Keep $KEYSTORE_FILE SAFE — never commit to git!"
echo "  2. Use PWABuilder (pwabuilder.com) to create APK/AAB:"
echo "     - Upload your signing key when prompted"
echo "     - Package name: app.aplo.twa"
echo "  3. Or use Bubblewrap CLI:"
echo "     npx @nicolo-ribaudo/bubblewrap init --manifest=https://yourdomain.com/manifest.json"
echo "     npx @nicolo-ribaudo/bubblewrap build"
echo ""
echo "⚠️  IMPORTANT: Add 'signing/' to .gitignore!"
echo ""
