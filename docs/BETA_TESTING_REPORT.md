# WatchNexus Beta Testing Report Template

## Report Metadata
| Field | Value |
|-------|-------|
| **Report ID** | WNBT-YYYY-MM-DD-### |
| **Tester Name** | |
| **Build Version** | v2.6.5 |
| **Platform** | Linux / macOS / Windows |
| **Date Started** | |
| **Date Completed** | |
| **Environment** | Self-hosted / Docker / Preview |
| **Browser** | Chrome / Firefox / Safari / Edge |
| **Resolution** | |

---

## 1. Authentication & User Management

### 1.1 Registration
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 1.1.1 | Navigate to /register | Registration form loads | | |
| 1.1.2 | Submit with valid email/username/password | Account created, redirected to dashboard | | |
| 1.1.3 | Submit with existing email | Error: "Email already registered" | | |
| 1.1.4 | Submit with empty fields | Validation errors shown | | |

### 1.2 Login
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 1.2.1 | Login with valid credentials | Authenticated, dashboard loads | | |
| 1.2.2 | Login with wrong password | Error: "Invalid credentials" | | |
| 1.2.3 | Token persistence | Refresh page, still logged in | | |

### 1.3 Logout
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 1.3.1 | Click logout | Redirected to login page | | |
| 1.3.2 | Access protected route after logout | Redirected to login | | |

---

## 2. Navigation & Sidebar

### 2.1 Sidebar Structure
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 2.1.1 | Check top-level items | Home, Library, Movies, TV Shows, Anime, Playlists, Music, Audiobooks, Streaming, Indexers visible | | |
| 2.1.2 | Check gadget items | Weather, Podcasts, Radio, Photos, Web Video visible | | |
| 2.1.3 | Check admin items | Security, VPN Portal, Lib Manager, Browse Media, Log Viewer, System, Marketplace under Settings | | |
| 2.1.4 | Expand/collapse Settings | Chevron toggles sub-items visibility | | |
| 2.1.5 | Sidebar collapse | Click collapse button, sidebar shrinks to icons | | |

### 2.2 Sidebar Tab Visibility
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 2.2.1 | Go to Settings > General > Sidebar Tabs | All 22 tabs shown in 3 groups (Media, Gadgets, Admin) | | |
| 2.2.2 | Toggle off a Media tab | Tab disappears from sidebar | | |
| 2.2.3 | Toggle off an Admin tab | Tab disappears from Settings submenu | | |
| 2.2.4 | Toggle back on | Tab reappears | | |
| 2.2.5 | Persistence | Reload page, toggled tabs remain hidden | | |

---

## 3. Media Libraries

### 3.1 Library Management
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 3.1.1 | Navigate to Library Manager | Library list loads (empty or populated) | | |
| 3.1.2 | Add new library | Name, path, type fields available | | |
| 3.1.3 | Folder browser opens | Filesystem browser shows directories | | |
| 3.1.4 | Select a directory | Path populated in library form | | |
| 3.1.5 | Save library | Library appears in list | | |
| 3.1.6 | Scan library | Scan initiates, progress shown | | |
| 3.1.7 | Delete library | Library removed from list | | |

### 3.2 Folder Browser (Cross-Platform)
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 3.2.1 | Default load | Home directory shown | | |
| 3.2.2 | Navigate to subdirectory | Directory contents load | | |
| 3.2.3 | Navigate up (parent) | Parent directory loads | | |
| 3.2.4 | Quick access drives | Root, Home, Media, Mounts visible | | |
| 3.2.5 | Permission denied directory | Error shown, doesn't crash | | |
| 3.2.6 | Empty directory | "Empty" state shown | | |
| 3.2.7 | Media file count | Shows count of media files in current dir | | |

---

## 4. Content Discovery (TMDB)

### 4.1 Dashboard
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 4.1.1 | Dashboard loads | Trending, Now Playing, Currently Airing sections | | |
| 4.1.2 | Trending content | Posters with titles load from TMDB | | |
| 4.1.3 | Click on content | Detail page loads with metadata | | |

### 4.2 Search
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 4.2.1 | Search for a movie | Results from TMDB displayed | | |
| 4.2.2 | Search for a TV show | Results displayed | | |
| 4.2.3 | Empty search | Appropriate message | | |

### 4.3 Watchlist
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 4.3.1 | Add item to watchlist | Item saved | | |
| 4.3.2 | View watchlist | All saved items displayed | | |
| 4.3.3 | Remove from watchlist | Item removed | | |

---

## 5. Gadgets

### 5.1 Weather (Open-Meteo)
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 5.1.1 | Navigate to Weather | Weather page loads | | |
| 5.1.2 | Search for location | Locations returned from geocoding API | | |
| 5.1.3 | Select location | Current weather + 7-day forecast displayed | | |
| 5.1.4 | Temperature units | Celsius/Fahrenheit toggle works | | |
| 5.1.5 | Save location | Persists across sessions | | |

### 5.2 Podcasts (iTunes + RSS)
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 5.2.1 | Navigate to Podcasts | Podcast page loads | | |
| 5.2.2 | Search for podcast | Results from iTunes API | | |
| 5.2.3 | Subscribe to podcast | Podcast added to library | | |
| 5.2.4 | View episodes | Episode list with descriptions | | |
| 5.2.5 | Unsubscribe | Podcast removed | | |

### 5.3 Radio (Radio Browser API)
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 5.3.1 | Navigate to Radio | Radio page loads | | |
| 5.3.2 | Browse stations | Stations listed from Radio Browser API | | |
| 5.3.3 | Search stations | Filtered results | | |
| 5.3.4 | Browse by country | Country-filtered stations | | |
| 5.3.5 | Add to favorites | Station saved | | |
| 5.3.6 | View favorites | Saved stations displayed | | |
| 5.3.7 | Remove favorite | Station removed | | |

### 5.4 Photos (Filesystem)
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 5.4.1 | Navigate to Photos | Photo libraries page loads | | |
| 5.4.2 | Add photo library path | Directory scanned for images | | |
| 5.4.3 | View photo gallery | Thumbnails displayed | | |
| 5.4.4 | View individual photo | Full-size photo loads | | |

### 5.5 Web Video
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 5.5.1 | Navigate to Web Video | Web Video page loads | | |
| 5.5.2 | Paste URL for info | Video metadata extracted | | |
| 5.5.3 | Bookmarks management | Add/remove bookmarks | | |
| 5.5.4 | History | Previously viewed URLs tracked | | |

---

## 6. IPTV

| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 6.1 | Navigate to Live TV | IPTV page loads | | |
| 6.2 | Add M3U playlist URL | Source added, channels parsed | | |
| 6.3 | View channels | Channel list with groups | | |
| 6.4 | Browse by group | Filtered channel list | | |
| 6.5 | View channel info | EPG data if available | | |
| 6.6 | Delete source | Source and channels removed | | |
| 6.7 | Export playlist | M3U file generated | | |

---

## 7. Downloads & Torrent

### 7.1 Built-in Torrent Client
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 7.1.1 | Navigate to Downloads | Download manager loads | | |
| 7.1.2 | Add magnet link | Download starts | | |
| 7.1.3 | View progress | Progress bar updates | | |
| 7.1.4 | Pause/Resume | Download pauses and resumes | | |
| 7.1.5 | Delete download | Download removed | | |

### 7.2 qBittorrent Integration (Optional)
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 7.2.1 | Configure qBit connection in Settings | Host/port/user/pass fields | | |
| 7.2.2 | Test connection | Success/failure reported | | |
| 7.2.3 | List torrents | Torrents from qBit displayed | | |

---

## 8. Subtitles

| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 8.1 | Navigate to subtitle settings | Provider configuration available | | |
| 8.2 | Configure OpenSubtitles credentials | Login saved | | |
| 8.3 | Search subtitles for movie | Results from configured providers | | |
| 8.4 | Search subtitles for TV episode | Results with season/episode match | | |
| 8.5 | Download subtitle | SRT/ASS file downloaded | | |
| 8.6 | Multiple providers | Addic7ed, Subscene results aggregated | | |

---

## 9. Security

### 9.1 Dashboard
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 9.1.1 | Navigate to Security | Security dashboard loads with stats | | |
| 9.1.2 | View audit logs | Log entries with timestamps | | |

### 9.2 IP Rules
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 9.2.1 | Add block rule | IP blocked | | |
| 9.2.2 | Add allow rule | IP whitelisted | | |
| 9.2.3 | Delete rule | Rule removed | | |

### 9.3 API Keys
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 9.3.1 | Generate API key | Key displayed (once) | | |
| 9.3.2 | Revoke API key | Key deactivated | | |

---

## 10. VPN Portal (WireGuard)

| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 10.1 | Navigate to VPN Portal | Server configuration page | | |
| 10.2 | Setup server | Keys generated, config saved | | |
| 10.3 | Activate server | WireGuard interface brought up | | |
| 10.4 | Add peer | Peer config generated with keys | | |
| 10.5 | View peer QR code | QR data for mobile config | | |
| 10.6 | Toggle peer | Peer enabled/disabled | | |
| 10.7 | Delete peer | Peer removed | | |
| 10.8 | Deactivate server | WireGuard interface brought down | | |
| 10.9 | View VPN stats | Transfer stats, connected peers | | |

---

## 11. Settings

### 11.1 General
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 11.1.1 | Sidebar tabs | All 22 toggleable | | |
| 11.1.2 | Theme settings | Theme options available | | |

### 11.2 Integrations
| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 11.2.1 | TMDB API key | Key saved, content loads | | |
| 11.2.2 | qBittorrent settings | Connection config saved | | |
| 11.2.3 | Subtitle providers | Credentials saved per provider | | |

---

## 12. System

| Step | Action | Expected Result | Status | Notes |
|------|--------|-----------------|--------|-------|
| 12.1 | System info | Version, hostname, platform, CPU, memory | | |
| 12.2 | Logs | Application logs viewable | | |
| 12.3 | Cache stats | Cache usage displayed | | |
| 12.4 | Database stats | DB size, table counts | | |

---

## Bug Report Section

### Bug Template
```
### BUG-###: [Short Description]
**Severity:** Critical / High / Medium / Low
**Section:** [Section number from above]
**Step:** [Step number]
**Status:** Open / In Progress / Fixed / Won't Fix

**Environment:**
- Platform:
- Browser:
- Build:

**Recreation Steps:**
1. 
2. 
3. 

**Expected Behavior:**

**Actual Behavior:**

**Screenshots/Logs:**

**Error Messages (Console/Network):**

**Workaround (if any):**
```

---

## Regression Checklist
After each fix, verify these core flows still work:

- [ ] Login/Logout
- [ ] Dashboard loads with TMDB content
- [ ] Sidebar navigation (all sections)
- [ ] Settings page loads
- [ ] Library CRUD
- [ ] Folder browser
- [ ] Search functionality
- [ ] At least one gadget (Weather)

---

## Performance Notes

| Metric | Value | Acceptable? |
|--------|-------|-------------|
| Initial page load | | < 3s |
| Login response | | < 1s |
| TMDB search | | < 2s |
| Folder browse | | < 1s |
| Library scan (100 files) | | < 30s |

---

## Summary

| Category | Total Tests | Passed | Failed | Blocked | Not Tested |
|----------|-------------|--------|--------|---------|------------|
| Auth | | | | | |
| Navigation | | | | | |
| Libraries | | | | | |
| TMDB/Content | | | | | |
| Gadgets | | | | | |
| IPTV | | | | | |
| Downloads | | | | | |
| Subtitles | | | | | |
| Security | | | | | |
| VPN | | | | | |
| Settings | | | | | |
| System | | | | | |
| **TOTAL** | | | | | |

### Sign-off
| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Dev Lead | | | |
| Product Owner | | | |
