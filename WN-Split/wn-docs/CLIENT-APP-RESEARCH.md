# WatchNexus Client App Feasibility Research

## Executive Summary

| Platform | Feasibility | Effort | Recommended Approach |
|----------|-------------|--------|---------------------|
| **Amazon Fire Stick** | ✅ HIGH | Medium | Native Android APK (sideload) |
| **Roku** | ⚠️ MEDIUM | High | BrightScript channel (sideload) |
| **Android TV** | ✅ HIGH | Medium | Native Android APK |
| **Android Mobile** | ✅ HIGH | Medium | Native Android APK |
| **Chromecast** | ✅ HIGH | Low | Cast SDK integration |
| **Kodi** | ✅ HIGH | Low | Python addon |

---

## Amazon Fire TV Stick

### Verdict: ✅ HIGHLY FEASIBLE

Fire TV runs **Fire OS** (Android fork), making it the easiest TV platform for WatchNexus.

### Development Approach
- **SDK**: Android Studio + Android SDK
- **Language**: Kotlin/Java
- **Min SDK**: API 22 (Fire OS 5 / Lollipop 5.1)
- **Target SDK**: API 34 (Fire OS 14 / Android 14)

### Distribution Options

| Method | Pros | Cons |
|--------|------|------|
| **Sideload APK** | Full control, instant updates, no review | Manual install via Downloader app |
| **Amazon Appstore** | Easy discovery, auto-updates | Review process, compliance rules |

### Sideloading Process (End User)
1. Enable Developer Options (tap device name 7x)
2. Enable "Apps from Unknown Sources"
3. Install "Downloader" from Appstore
4. Enter APK URL → Install → Done

### Technical Notes
- ExoPlayer works natively for HLS/DASH streaming
- MediaSession for playback controls
- Leanback library for TV UI
- No Google Play Services - use Amazon alternatives

### Estimated Effort: 2-3 weeks
- Can reuse 80% of Android mobile app code
- Add TV-specific UI (leanback layouts)
- Remote control navigation support

---

## Roku

### Verdict: ⚠️ MODERATELY FEASIBLE (with limitations)

Roku uses a proprietary ecosystem that's more restrictive than Android.

### Development Approach
- **Language**: BrightScript (proprietary scripting language)
- **UI**: XML component framework
- **Tools**: VS Code + Roku plugin, create-roku-app

### Key Limitations

| Limitation | Impact |
|------------|--------|
| No sideloading for end users | Must use Developer Mode |
| One sideloaded app at a time | Switching apps removes previous |
| BrightScript only | Can't reuse existing code |
| Certification for public release | Strict requirements |
| No local file access | Streams only |

### Distribution Options

| Method | Feasibility | Notes |
|--------|-------------|-------|
| **Developer Mode Sideload** | ✅ Works | Each user enables dev mode, uploads ZIP |
| **Private Channel** | ❌ Discontinued | No longer available to public |
| **Beta Channel** | ⚠️ Limited | Invite-only, time-limited |
| **Channel Store** | ❌ Not recommended | Heavy certification, content policies |

### Developer Mode Sideload Process
```
Remote: Home x3 → Up x2 → Right → Left → Right → Left → Right
Browser: http://<roku-ip>
Login: rokudev / <your-password>
Upload: channel.zip
```

### Technical Architecture for Roku
```
WatchNexus Roku Channel
├── manifest (channel metadata)
├── source/
│   ├── main.brs (entry point)
│   ├── api.brs (server communication)
│   └── player.brs (video playback)
├── components/
│   ├── HomeScene.xml (main UI)
│   ├── VideoPlayer.xml
│   └── MediaGrid.xml
└── images/ (channel artwork)
```

### Estimated Effort: 4-6 weeks
- Learn BrightScript from scratch
- Build entire UI in XML components
- No code reuse possible
- Test on multiple Roku devices

### Recommendation
**Deprioritize Roku** unless user demand is high. The ROI is low compared to Fire Stick which covers similar TV market with Android code reuse.

---

## Comparison: Fire Stick vs Roku

| Factor | Fire TV Stick | Roku |
|--------|---------------|------|
| **Market Share** | ~35% US streaming | ~30% US streaming |
| **Dev Language** | Kotlin/Java (Android) | BrightScript (proprietary) |
| **Code Reuse** | 80%+ from Android | 0% |
| **Sideloading** | Easy (Downloader app) | Complex (dev mode only) |
| **APK Distribution** | Direct URL download | ZIP upload via browser |
| **Update Process** | User downloads new APK | User re-uploads ZIP |
| **Local Media** | Supported | Not supported |
| **Development Time** | 2-3 weeks | 4-6 weeks |

---

## Other Platforms (Already Planned)

### Android TV
- Same as Fire Stick development
- Use Leanback library
- Distribute via APK or Play Store

### Android Mobile  
- Standard Android development
- Material Design UI
- Play Store or direct APK

### Chromecast
- Add Google Cast SDK to web app
- Receiver app for TV display
- ~1 week integration

### Kodi Addon
- Python-based addon
- Repository distribution
- ~1-2 weeks development

---

## Recommended Priority Order

1. **Android Mobile** - Largest user base, foundation for TV apps
2. **Fire TV Stick** - Easy Android port, large TV market
3. **Android TV** - Same codebase as Fire TV
4. **Chromecast** - Quick integration, wide compatibility
5. **Kodi** - Enthusiast audience, Python addon
6. **Roku** - Only if significant user demand (high effort, low reuse)

---

## Technical Requirements for Fire TV App

### Manifest Additions
```xml
<uses-feature android:name="android.hardware.touchscreen" android:required="false"/>
<uses-feature android:name="android.software.leanback" android:required="true"/>

<application android:banner="@drawable/banner">
    <activity android:name=".MainActivity">
        <intent-filter>
            <action android:name="android.intent.action.MAIN"/>
            <category android:name="android.intent.category.LEANBACK_LAUNCHER"/>
        </intent-filter>
    </activity>
</application>
```

### Key Dependencies
```gradle
implementation 'androidx.leanback:leanback:1.0.0'
implementation 'com.google.android.exoplayer:exoplayer:2.19.1'
implementation 'com.squareup.retrofit2:retrofit:2.9.0'
```

### D-pad Navigation
- All UI elements must be focusable
- Implement `onKeyDown()` for remote control
- Visual focus indicators required

---

## Conclusion

**Fire TV Stick is the clear winner** for TV platform expansion:
- Reuses Android codebase
- Easy sideloading for self-hosted software
- Large market share
- Straightforward development

**Roku should be deprioritized** unless there's significant user demand:
- Proprietary language (no code reuse)
- Complex distribution
- Higher development effort
- Limited functionality compared to Android

For a self-hosted media application like WatchNexus, Fire TV + Android TV + Chromecast covers the majority of TV streaming use cases with maximum code efficiency.
