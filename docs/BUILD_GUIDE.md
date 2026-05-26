# MyStore OS — Capacitor Build Guide
# Android (Play Store) + iOS (App Store)

## Prerequisites
- Node.js 18+
- Android Studio (for Android)
- Xcode 15+ on macOS (for iOS)
- Java 17+

---

## STEP 1 — Clone and install

```bash
git clone https://github.com/karthikeyadev2025-cloud/mystoreos.git
cd mystoreos
npm install
```

---

## STEP 2 — Build web app

```bash
npm run build
```

---

## STEP 3 — Add native platforms

```bash
npx cap add android
npx cap add ios
npx cap sync
```

---

## STEP 4A — ANDROID BUILD

### 4A.1 — Copy app icons
```
Copy android/mipmap-* folders from app-assets/android/ into:
android/app/src/main/res/
```

### 4A.2 — Copy splash screen
```
android/app/src/main/res/drawable/splash.png
android/app/src/main/res/drawable-land/splash.png
```

### 4A.3 — Open in Android Studio
```bash
npx cap open android
```

### 4A.4 — Update android/app/build.gradle
```gradle
android {
    defaultConfig {
        applicationId "in.mystoreos.app"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

### 4A.5 — Generate keystore (one time only)
```bash
keytool -genkey -v \
  -keystore mystore-release.keystore \
  -alias mystore-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=MyStore OS, OU=Engineering, O=MyStore, L=Chennai, ST=Tamil Nadu, C=IN"
```
⚠️ Save the keystore password securely — you need it for every future update.

### 4A.6 — Sign and build AAB
In Android Studio:
Build → Generate Signed Bundle/APK → Android App Bundle → 
Select keystore → mystore-release.keystore → 
Key alias: mystore-key → Release → Build

Output: android/app/release/app-release.aab

### 4A.7 — Upload to Play Store
1. Go to play.google.com/console
2. Create app → "MyStore OS — GST Billing App"
3. App category: Business
4. Upload app-release.aab to Internal Testing first
5. Add store listing content (see STORE_LISTING.md)
6. Add screenshots (5 minimum for phones)
7. Submit for review (usually 1-3 days)

---

## STEP 4B — iOS BUILD (requires macOS + Xcode)

### 4B.1 — Open in Xcode
```bash
npx cap open ios
```

### 4B.2 — Configure in Xcode
- Select "App" target
- Bundle Identifier: in.mystoreos.app
- Version: 1.0.0
- Build: 1
- Deployment Target: iOS 14.0

### 4B.3 — Copy iOS icons
In Xcode, open Assets.xcassets → AppIcon
Replace each slot with the matching icon from app-assets/ios/:
- 20pt @1x: icon-20.png
- 20pt @2x: icon-40.png
- 20pt @3x: icon-60.png
- 29pt @1x: icon-29.png
- 29pt @2x: icon-58.png
- 29pt @3x: icon-87.png
- 40pt @2x: icon-80.png
- 40pt @3x: icon-120.png
- 60pt @2x: icon-120.png
- 60pt @3x: icon-180.png
- 76pt @1x: icon-76.png
- 76pt @2x: icon-152.png
- 83.5pt @2x: icon-167.png
- 1024pt @1x: icon-1024.png (App Store)

### 4B.4 — Add capabilities in Xcode
Signing & Capabilities:
- Push Notifications
- Background Modes → Remote notifications
- Camera (already in Info.plist via Capacitor)

### 4B.5 — Info.plist additions
Add these keys in Xcode → Info tab:
```
NSCameraUsageDescription → "MyStore OS uses camera for barcode scanning"
NSPhotoLibraryUsageDescription → "MyStore OS accesses photos for product images"
```

### 4B.6 — Build archive
- Select device: "Any iOS Device (arm64)"
- Product → Archive
- Window → Organizer → Distribute App → App Store Connect

### 4B.7 — Submit to App Store
1. Go to appstoreconnect.apple.com
2. Apps → New App → iOS
3. Bundle ID: in.mystoreos.app
4. Name: MyStore OS — GST Billing
5. Upload screenshots (iPhone 6.7", iPad 12.9")
6. Fill app information (see STORE_LISTING.md)
7. Submit for review (usually 1-7 days)

---

## STEP 5 — Future updates (after code changes)

```bash
npm run build          # Build new web bundle
npx cap sync           # Sync to both platforms
# Then build new AAB in Android Studio / Archive in Xcode
```

---

## App IDs & Bundle Info

| | Android | iOS |
|---|---|---|
| Bundle ID | in.mystoreos.app | in.mystoreos.app |
| App Name | MyStore OS | MyStore OS |
| Version | 1.0.0 | 1.0.0 |
| Min OS | Android 5.1 (API 22) | iOS 14.0 |
| Architecture | arm64, x86_64 | arm64 |

