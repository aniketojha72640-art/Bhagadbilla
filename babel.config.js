name: Build Android APK

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install --legacy-peer-deps

      - name: Generate Native Android project
        run: npx expo prebuild --platform android --clean

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Build Debug APK (ARM64 Optimized, No Keystore Required)
        working-directory: android
        run: ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a -Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=1024m"

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: Bhagadbilla-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk
