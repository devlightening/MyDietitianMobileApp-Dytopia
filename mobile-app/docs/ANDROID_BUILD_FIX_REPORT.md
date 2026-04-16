# Android EAS Build Fix Report

## Root Cause

The `android/` directory was generated with the wrong package name (`com.anonymous.mobileapp` instead of `com.mydietitian.mobileapp`). This caused "No matching variant / No variants exist" Gradle errors because native modules could not link against the correct application package. Additional issues included an invalid Expo schema field, missing `expo-font` peer dependency, and version mismatches.

## Files Changed

### `app.json`
- Removed `android.usesCleartextTraffic: true` (invalid Expo schema field)

### `app.config.ts`
- Added `withAndroidManifest` config plugin to inject `android:usesCleartextTraffic="true"` on prebuild
- Added `ExpoConfig` import alongside `ConfigContext`

### `package.json`
- `expo`: `~54.0.31` → `~54.0.33`
- Added `expo-font: ~13.0.4` (missing peer dep for `@expo/vector-icons`)
- `react-native-worklets`: `0.8.0` → `0.5.1` (Expo SDK 54 compatible version)

### `android/app/build.gradle`
- `namespace`: `com.anonymous.mobileapp` → `com.mydietitian.mobileapp`
- `applicationId`: `com.anonymous.mobileapp` → `com.mydietitian.mobileapp`

### `android/gradle.properties`
- `reactNativeArchitectures`: `x86_64` → `armeabi-v7a,arm64-v8a,x86,x86_64`

### `android/app/src/main/AndroidManifest.xml`
- Added `android:usesCleartextTraffic="true"` to `<application>` tag
- Receiver action: `com.anonymous.mobileapp.DEBUG_TEST_NOTIFICATION` → `com.mydietitian.mobileapp.DEBUG_TEST_NOTIFICATION`
- Deep link scheme: `exp+mobile-app` → `exp+mydietitian-mobile`

### Kotlin source files (all in `android/app/src/main/java/com/anonymous/mobileapp/`)
- `MainApplication.kt` — package + imports updated
- `MainActivity.kt` — package updated
- `notifications/NotificationTestPackage.kt` — package updated
- `notifications/NotificationTestModule.kt` — package updated
- `notifications/NotificationTestReceiver.kt` — package + action string updated
- `notifications/LocalNotificationHelper.kt` — package + R import + action strings updated

## Commands to Run Locally

```bash
# 1. Clean node_modules and reinstall (version changes in package.json)
cd mobile-app
rm -rf node_modules
npm install

# 2. Trigger EAS cloud build (Android APK, preview profile)
eas build -p android --profile preview
```

> **Note:** You do NOT need to run `npx expo prebuild --clean` manually — EAS cloud does this automatically before the Gradle build. The `withAndroidManifest` plugin in `app.config.ts` ensures `usesCleartextTraffic` is set on every prebuild.

## Do I Need To Delete Build Cache?

| Action | Required? | Why |
|--------|-----------|-----|
| `rm -rf node_modules` | **Yes** | `expo-font` added, `worklets` version changed |
| `npm install` | **Yes** | After deleting node_modules |
| `npx expo prebuild --clean` | **No** (EAS does it) | EAS runs prebuild automatically |
| `eas build -p android --profile preview` | **Yes** | The actual build |

## Verification

After `npm install`, run:

```bash
npx expo doctor
```

Expected result: all issues resolved (no schema errors, no missing peer deps, no version mismatches).
