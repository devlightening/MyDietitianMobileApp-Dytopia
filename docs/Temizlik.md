MyDietitian mobile app Android EAS build is failing. I need you to FIX the project files, not just explain.

CONTEXT
The build now fails in Gradle with native dependency resolution errors. The important errors are:

- Could not resolve project :react-native-community_datetimepicker
- Could not resolve project :react-native-reanimated
- Could not resolve project :react-native-safe-area-context
- Could not resolve project :react-native-screens
- Could not resolve project :react-native-worklets
- "No matching variant ... No variants exist"

Also expo doctor reports these issues:
1. Expo config schema error:
   Field: android - should NOT have additional property 'usesCleartextTraffic'
2. Missing peer dependency: expo-font required by @expo/vector-icons
3. Duplicate native module dependency for expo-font
4. Version mismatches:
   - react-native-worklets expected 0.5.1, found 0.8.0
   - expo expected ~54.0.33, found 54.0.31

GOAL
Make the mobile project build successfully with:
eas build -p android --profile preview

YOUR TASK
I want you to inspect and MODIFY the project so the Android build works cleanly under Expo SDK 54 / EAS.

DO NOT stop at analysis. Apply real file changes.

PRIORITY FIXES
1. Remove invalid Expo config fields
   - Find where android.usesCleartextTraffic is defined
   - Remove it from Expo config if it is in app.json/app.config.ts schema-invalid location
   - If cleartext traffic is really needed, move it to the proper Android native manifest/plugin approach instead of invalid Expo config

2. Fix dependency alignment for Expo SDK 54
   - Make package versions compatible with installed Expo SDK
   - Align expo to expected version (~54.0.33 if needed)
   - Align react-native-worklets to expected version (0.5.1 if that is the correct Expo SDK 54 compatible version)
   - Install missing peer dependency expo-font properly
   - Deduplicate expo-font so only the correct version remains in the project dependency graph

3. Investigate native linking issue
   The “No matching variant / No variants exist” errors for datetimepicker, reanimated, safe-area-context, screens, and worklets strongly suggest stale or incorrect native linking/manual Android wiring.
   Please inspect and fix:
   - android/settings.gradle
   - android/app/build.gradle
   - android/build.gradle
   - android/gradle.properties
   - android/app/src/main/AndroidManifest.xml
   - android/app/src/main/java/.../MainApplication.*
   - android/app/src/main/java/.../MainActivity.*
   - react-native.config.js if present
   - package.json scripts and plugins
   - Expo plugins / prebuild setup

   Remove any old manual linking remnants that conflict with Expo autolinking.
   If the android directory is stale and generated from an older state, cleanly regenerate it in the safest possible way for this repo.

4. Make the project EAS-friendly
   - Ensure app.config.ts, eas.json, package.json, and native Android config are consistent
   - Do not break the existing API base URL env setup
   - Preserve EAS projectId setup
   - Preserve current package name / slug / app identity unless absolutely necessary

5. Clean install / lockfile hygiene
   - Fix package.json and lockfile issues
   - Ensure one consistent package manager outcome
   - Remove duplicate/invalid dependency states
   - Make sure expo doctor passes or at least all build-blocking issues are resolved

6. Add a short MD report
   Create a short file like:
   mobile-app/docs/ANDROID_BUILD_FIX_REPORT.md

   Include:
   - root cause
   - files changed
   - package changes
   - exact commands I should run next
   - whether I need to delete node_modules / android build cache / reinstall

OUTPUT REQUIREMENTS
When done, give me:
1. Exact files changed
2. Exact dependency changes
3. Exact commands to run locally next
4. Whether I should run:
   - rm -rf node_modules
   - npm install
   - npx expo prebuild --clean
   - eas build -p android --profile preview
5. A short explanation in Turkish

IMPORTANT
- Code stays in English
- Explanations to me in Turkish
- Be conservative and minimal, but fix the real native build problem
- If stale generated Android files are the issue, regenerate them safely
- Do not leave the project in a half-fixed state
- Apply edits directly