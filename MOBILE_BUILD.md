# MyStore OS — Mobile App Build Guide
## Android (Play Store) + iOS (App Store) + OTA Live Updates

---

## 🏗 Architecture Overview

```
Web Deploy (Vercel)          Native App Shell (Capacitor)       OTA Updates (Capgo)
┌─────────────────┐          ┌──────────────────────────────┐   ┌────────────────┐
│ mystoreos.in    │          │ MyStore OS APK/IPA           │   │ capgo.app      │
│ (React + Vite)  │  →copy→  │ WebView wraps dist/          │   │ Push new JS    │
│ Supabase DB     │          │ Capacitor plugins for native │   │ bundle OTA     │
│ Live global DB  │          │ Android + iOS native APIs    │   │ No Play Store  │
└─────────────────┘          └──────────────────────────────┘   │ wait needed    │
                                                                  └────────────────┘
```

**Database**: Supabase (global, real-time) — same DB for web + app. No extra setup.
**Updates**: 2 types:
1. **Play Store update** — new native features (plugins, permissions). Rare.
2. **OTA update (Capgo)** — new JS/UI/logic. Happens silently in background. Next launch = new version.

---

## 📋 Prerequisites

Install on your machine:
- **Node.js 18+** — https://nodejs.org
- **Android Studio** — https://developer.android.com/studio
- **Xcode 15+** (Mac only) — App Store
- **Java JDK 17** — https://adoptium.net

---

## 🚀 One-Time Setup

### 1. Add Native Platforms

```bash
cd mystoreos
npm install

# Add Android
npx cap add android

# Add iOS (Mac only)
npx cap add ios
```

### 2. Setup Capgo (OTA Live Updates)

```bash
# Install Capgo CLI
npm install -g @capgo/cli

# Login to Capgo (create free account at capgo.app)
npx capgo login

# Init your app
npx capgo init

# This gives you an API key — add to capacitor.config.json:
# "privateKey": "YOUR_CAPGO_API_KEY"
```

### 3. Generate Android Keystore (ONE TIME ONLY — store safely!)

```bash
keytool -genkey -v \
  -keystore android/mystore-release.keystore \
  -alias mystore-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=MyStore OS, OU=Mobile, O=MyStore Technologies, L=Hyderabad, S=Telangana, C=IN"

# Set passwords in android/local.properties:
MYSTORE_RELEASE_STORE_FILE=mystore-release.keystore
MYSTORE_RELEASE_KEY_ALIAS=mystore-key
MYSTORE_RELEASE_STORE_PASSWORD=YourStorePassword
MYSTORE_RELEASE_KEY_PASSWORD=YourKeyPassword
```

---

## 🤖 Android Build & Deploy

### Build Release APK/AAB

```bash
# Build web + sync to Android
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android

# In Android Studio:
# Build → Generate Signed Bundle/APK
# Choose "Android App Bundle" (AAB) for Play Store
# Sign with mystore-release.keystore
```

### Upload to Play Store

1. Go to https://play.google.com/console
2. Create App → "MyStore OS"
3. Upload the `.aab` file from `android/app/build/outputs/bundle/release/`
4. Set package name: `in.mystoreos.app`
5. Fill store listing (description, screenshots, icon 512×512)

### Android Permissions (add to `android/app/src/main/AndroidManifest.xml`)

```xml
<!-- Camera for barcode scanning -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />

<!-- Network -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Push notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Storage for PDF save -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
  android:maxSdkVersion="28" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
  android:maxSdkVersion="32" />
```

### android/app/build.gradle — Signing Config

```gradle
android {
    signingConfigs {
        release {
            storeFile file('../mystore-release.keystore')
            storePassword System.getenv('MYSTORE_RELEASE_STORE_PASSWORD') ?: project.properties['MYSTORE_RELEASE_STORE_PASSWORD']
            keyAlias System.getenv('MYSTORE_RELEASE_KEY_ALIAS') ?: project.properties['MYSTORE_RELEASE_KEY_ALIAS']
            keyPassword System.getenv('MYSTORE_RELEASE_KEY_PASSWORD') ?: project.properties['MYSTORE_RELEASE_KEY_PASSWORD']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 🍎 iOS Build & Deploy

```bash
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:
1. Select your Apple Developer Team
2. Set Bundle ID: `in.mystoreos.app`
3. Product → Archive
4. Distribute App → App Store Connect

### iOS Info.plist additions

```xml
<!-- Camera permission -->
<key>NSCameraUsageDescription</key>
<string>MyStore OS uses camera to scan product barcodes</string>

<!-- Photo library -->
<key>NSPhotoLibraryUsageDescription</key>
<string>To upload shop photos and product images</string>

<!-- Push notifications entitlement -->
<!-- Enable in Xcode: Signing & Capabilities → + Capability → Push Notifications -->
```

---

## ⚡ OTA Live Updates (Capgo) — No Play Store Wait!

### How it works
When you deploy to Vercel, the web version updates instantly.
For the native app, Capgo downloads the new JS bundle silently in the background.
Next time user opens the app — they're on the new version. **No Play Store approval needed!**

### Deploy OTA Update

```bash
# After making changes to src/
npm run build

# Upload to Capgo (production channel)
npx capgo upload --channel production

# That's it! App users get the update on next launch.
```

### What triggers a Play Store update vs OTA update?

| Change | Play Store Update | OTA (Capgo) |
|--------|------------------|-------------|
| New React feature/page | ✅ OTA only | ✅ |
| New API call | ✅ OTA only | ✅ |
| Bug fix in JS | ✅ OTA only | ✅ |
| New native plugin | ❌ Play Store | ❌ |
| Permission change | ❌ Play Store | ❌ |
| App icon/name change | ❌ Play Store | ❌ |

**Rule of thumb**: If it's a code change (React, API, UI) → OTA. If it's a native change → Play Store.

---

## 🔄 Daily Workflow After Initial Setup

### Update website + app simultaneously

```bash
# 1. Make your changes in src/
# 2. Build and deploy web (Vercel auto-deploys on git push)
git add -A && git commit -m "feat: ..." && git push origin main

# 3. Deploy OTA to app (runs in 30 seconds)
npm run build && npx capgo upload --channel production

# Web users: instant update
# App users: update on next launch (background download)
```

---

## 🗄 Live Database (Supabase — Already Configured)

Your Supabase database is **already shared** between web and app. Both platforms:
- Read/write the same `orders`, `products`, `users` tables
- Real-time subscriptions work on both
- RLS policies protect data automatically

No extra config needed — it just works.

---

## 📱 App Store Assets Checklist

### Play Store (Android)
- [ ] App icon: 512×512 PNG (no alpha)
- [ ] Feature graphic: 1024×500 PNG
- [ ] Screenshots: Phone (min 2), Tablet optional
- [ ] Short description: 80 chars — "India's fastest billing & inventory OS for shops"
- [ ] Full description: 4000 chars
- [ ] Privacy policy URL: mystoreos.in/privacy
- [ ] Category: Business

### App Store (iOS)
- [ ] App icon: 1024×1024 PNG (no alpha, no rounded corners)
- [ ] Screenshots: 6.7" iPhone (required), iPad optional
- [ ] Preview video: optional but recommended
- [ ] Privacy policy: required
- [ ] Support URL: mystoreos.in/support

---

## 🔧 Useful Commands

```bash
# Full build + sync both platforms
npm run build && npx cap sync

# Open Android Studio
npx cap open android

# Open Xcode
npx cap open ios

# Run on connected Android device
npx cap run android

# Run on iOS simulator
npx cap run ios

# Check Capgo channels
npx capgo channel list

# View OTA update history
npx capgo bundle list

# Roll back to previous OTA bundle
npx capgo bundle set --channel production --bundle BUNDLE_ID
```

---

## 🆘 Troubleshooting

**White screen on Android**: Clear app data, check `androidScheme: "https"` in capacitor.config.json

**OTA not applying**: Check `CapacitorUpdater.notifyAppReady()` is called (it's in native.js auto-init)

**Camera not working**: Add camera permission to AndroidManifest.xml and Info.plist

**Build fails**: Run `npx cap doctor` to diagnose

**Keystore lost**: You CANNOT re-upload to Play Store without the original keystore. Store it safely!
