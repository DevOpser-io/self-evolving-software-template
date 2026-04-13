#!/bin/bash

# Script to configure Android app signing for production builds
# This modifies the android/app/build.gradle file to use keystore.properties

set -e

GRADLE_FILE="android/app/build.gradle"

if [ ! -f "$GRADLE_FILE" ]; then
    echo "Error: $GRADLE_FILE not found!"
    echo "Please run 'npx cap sync android' first to generate the Android project."
    exit 1
fi

echo "Configuring Android app signing in $GRADLE_FILE..."

# Check if signing config already exists
if grep -q "signingConfigs {" "$GRADLE_FILE"; then
    echo "✓ Signing configuration already exists in build.gradle"
    exit 0
fi

# Create backup
cp "$GRADLE_FILE" "$GRADLE_FILE.backup"
echo "✓ Created backup: $GRADLE_FILE.backup"

# Create temporary file with the signing configuration
cat > /tmp/signing_config.txt << 'EOF'

    // Load keystore properties
    def keystorePropertiesFile = rootProject.file("keystore.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
    }

    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }
EOF

# Insert signing config after 'android {' line
awk '
    /^android \{/ {
        print
        system("cat /tmp/signing_config.txt")
        next
    }
    { print }
' "$GRADLE_FILE" > "$GRADLE_FILE.tmp"

mv "$GRADLE_FILE.tmp" "$GRADLE_FILE"

# Update buildTypes to use the signing config
if grep -q "buildTypes {" "$GRADLE_FILE"; then
    # Add signingConfig to release buildType
    sed -i '/release {/a\            signingConfig signingConfigs.release' "$GRADLE_FILE"
    echo "✓ Added signingConfig to release buildType"
fi

# Clean up
rm /tmp/signing_config.txt

echo "✓ Android signing configuration complete!"
echo ""
echo "The build.gradle file now supports:"
echo "  - Debug builds (uses debug keystore)"
echo "  - Release builds (uses keystore.properties if available)"
echo ""
echo "To build a signed release APK:"
echo "  cd android && ./gradlew assembleRelease"
