# Strudel Module Investigation: Optical Disc Ripping

## Module Identity
- **Name:** Optical Disc Ripping
- **Codename:** Strudel
- **Version:** 2.8.4
- **Category:** Media Acquisition
- **Priority:** P1

---

## 1. Executive Summary

The Strudel module adds optical disc ripping and transcoding capabilities to WatchNexus, enabling users to extract video, audio, and subtitles from DVD and Blu-ray media, transcode them into standard formats, and automatically import them into the WatchNexus media library with full metadata.

The module wraps two industry-standard CLI tools — **MakeMKV** (ripping/decryption) and **HandBrake** (transcoding) — through a managed pipeline with progress tracking, queue management, and library integration.

**Reference implementations:** MakeMKV, VidCoder, Automatic Ripping Machine (ARM)

---

## 2. Tool Analysis

### 2.1 MakeMKV (`makemkvcon`)

**Purpose:** Disc decryption and lossless MKV extraction.

| Aspect | Details |
|--------|---------|
| Binary | `makemkvcon` (CLI) |
| Input | Physical disc (`disc:0`), ISO file, BDMV/VIDEO_TS folder |
| Output | Lossless MKV files (no re-encoding) |
| DVD Support | CSS decryption via built-in libdvdcss |
| Blu-ray Support | AACS/BD+ decryption (requires key database) |
| UHD BD Support | Requires flashed drive (e.g., ASUS BW-16D1HT with LibreDrive firmware) |
| Licensing | Free for DVD, beta key for Blu-ray (free during beta period) |
| Robot Mode | `--robot` flag outputs parseable line-based data |

**Key CLI Commands:**
```bash
# Scan disc info
makemkvcon -r info disc:0

# Rip all titles to MKV
makemkvcon mkv disc:0 all /output/path

# Rip specific title (e.g., title 0)
makemkvcon mkv disc:0 0 /output/path

# Full disc backup with decryption
makemkvcon backup --decrypt disc:0 /output/path

# Set minimum title length (seconds)
makemkvcon mkv --minlength=120 disc:0 all /output/path
```

**Robot Mode Output Format:**

| Line Type | Format | Description |
|-----------|--------|-------------|
| `MSG` | `MSG:code,flags,count,message,format,param...` | Status/error messages |
| `PRGT` | `PRGT:code,id,"name"` | Progress bar title (current operation) |
| `PRGC` | `PRGC:code,id,"name"` | Progress bar current step |
| `PRGV` | `PRGV:current,total,max` | Progress values (current/total out of max) |
| `TCOUT` | `TCOUT:count` | Total title count on disc |
| `CINFO` | `CINFO:id,code,"value"` | Disc-level metadata |
| `TINFO` | `TINFO:title_num,id,code,"value"` | Title-level metadata |
| `SINFO` | `SINFO:title_num,stream_num,id,code,"value"` | Stream-level metadata |
| `DRV` | `DRV:index,visible,enabled,flags,"name","disc_name"` | Drive info |

**Key Attribute IDs (from apdefs.h):**

| ID | Attribute | Example Value |
|----|-----------|---------------|
| 1 | Type | "Blu-ray disc" |
| 2 | Name/Label | "MY_MOVIE" |
| 8 | Chapter Count | "32" |
| 9 | Duration | "2:15:30" |
| 10 | Size (human) | "25.4 GB" |
| 11 | Size (bytes) | "27262976000" |
| 16 | Playlist/File | "00800.mpls" |
| 19 | Resolution | "1920x1080" |
| 20 | Aspect Ratio | "16:9" |
| 21 | Frame Rate | "23.976 (24000/1001)" |
| 27 | Suggested Filename | "title_t00.mkv" |
| 28 | Language Code | "eng" |
| 29 | Language Name | "English" |
| 30 | Codec ID | "V_MPEG4/ISO/AVC" |
| 31 | Codec Short | "Mpeg4 AVC High" |
| 33 | Tree Info | Chapters/segments |
| 38 | Audio Channels | "8" |
| 39 | Bitrate | "10751 Kb/s" |
| 40 | Audio Sample Rate | "48000" |
| 42 | Output Filename | "title00.mkv" |

### 2.2 HandBrake (`HandBrakeCLI`)

**Purpose:** Video transcoding with quality control.

| Aspect | Details |
|--------|---------|
| Binary | `HandBrakeCLI` |
| Input | MKV, MP4, ISO, VIDEO_TS, disc device |
| Output | MKV, MP4 (WebM experimental) |
| Video Codecs | H.264, H.265/HEVC, AV1, VP9, MPEG-2 |
| Audio Codecs | AAC, AC-3, E-AC-3, FLAC, MP3, Opus, Vorbis (+ passthrough) |
| HW Accel | Intel QSV, NVIDIA NVENC, AMD VCE, Apple VideoToolbox |
| Presets | JSON-based, exportable from GUI |

**Key CLI Commands:**
```bash
# Transcode with preset
HandBrakeCLI -i input.mkv -o output.mkv --preset-import-file presets.json -Z "My Preset"

# H.265 CRF 20, AAC stereo + AC-3 passthrough
HandBrakeCLI -i input.mkv -o output.mkv -e x265 -q 20 \
  --audio 1,1 --aencoder aac,copy:ac3 --ab 160 \
  --subtitle 1,2,3 --subtitle-default 1

# Scan title (no encoding)
HandBrakeCLI -i input.mkv --scan

# Hardware-accelerated encoding (NVENC)
HandBrakeCLI -i input.mkv -o output.mkv -e nvenc_h265 -q 24
```

**Preset Structure (JSON):**
```json
{
  "PresetName": "WatchNexus 1080p",
  "VideoEncoder": "x265",
  "VideoQualityType": 2,
  "VideoQualitySlider": 20,
  "AudioList": [
    { "AudioEncoder": "av_aac", "AudioBitrate": 160, "AudioMixdown": "stereo" },
    { "AudioEncoder": "copy:ac3", "AudioPassthruCodec": "ac3" }
  ],
  "SubtitleList": [
    { "SubtitleBurnIn": false, "SubtitleForced": false }
  ]
}
```

### 2.3 Supporting Tools

| Tool | Purpose | Install |
|------|---------|---------|
| `mkvmerge` | MKV muxing/remuxing (MKVToolNix) | `apt install mkvtoolnix` |
| `mkvextract` | Extract tracks/chapters from MKV | Included with mkvtoolnix |
| `mkvinfo` | Inspect MKV structure | Included with mkvtoolnix |
| `ffprobe` | Media file inspection | `apt install ffmpeg` |
| `ffmpeg` | Subtitle extraction (text-based) | `apt install ffmpeg` |
| `ccextractor` | Closed caption extraction | `apt install ccextractor` |
| `lsscsi` | List SCSI devices (optical drives) | `apt install lsscsi` |
| `lsblk` | List block devices | Built into Linux |
| `udevadm` | Device event monitoring | Built into Linux |

### 2.4 Comparison: MakeMKV vs HandBrake vs ARM

| Feature | MakeMKV | HandBrake | ARM | **Strudel** |
|---------|---------|-----------|-----|-------------|
| DVD Ripping | Lossless | With libdvdcss | MakeMKV | MakeMKV |
| BD Ripping | Lossless | Unprotected only | MakeMKV | MakeMKV |
| Transcoding | No | Yes (extensive) | HandBrake | HandBrake |
| Drive Detection | Manual | Manual | udev auto | Polling + udev |
| Queue System | No | No | Yes | Yes |
| Metadata Lookup | No | No | OMDb | TMDB (existing) |
| Library Integration | No | No | Plex/Emby notify | Native WatchNexus |
| Web UI | No | HandBrake-Web | Yes (port 8080) | Integrated |
| Subtitle Extraction | In MKV only | In MKV only | Same | Post-process |
| HW Acceleration | N/A | QSV/NVENC/VCE | HandBrake | HandBrake |

---

## 3. Architecture Design

### 3.1 Pipeline Stages

```
[Disc Inserted] → [1. Detect] → [2. Scan] → [3. Select] → [4. Rip] → [5. Transcode] → [6. Extract] → [7. Import] → [Done]
     ↓                ↓             ↓            ↓              ↓             ↓              ↓             ↓
  udev/poll      makemkvcon     User UI      makemkvcon    HandBrakeCLI   mkvextract     Library API
                   -r info                    mkv/backup                  ffmpeg         TMDB lookup
```

**Stage Details:**

| Stage | Tool | Input | Output | Blocking? |
|-------|------|-------|--------|-----------|
| 1. Detect | lsscsi, lsblk, udevadm | System | Drive list + disc presence | No |
| 2. Scan | `makemkvcon -r info disc:N` | Disc | Title list, streams, metadata | No (async) |
| 3. Select | User (frontend) | Scan results | Selected titles + config | Manual |
| 4. Rip | `makemkvcon mkv disc:N T /out` | Disc | Lossless MKV file(s) | Yes (long) |
| 5. Transcode | `HandBrakeCLI -i mkv -o out` | MKV | Compressed MKV/MP4 | Yes (long) |
| 6. Extract | mkvextract, ffmpeg | MKV | SRT subs, audio tracks | No (fast) |
| 7. Import | WatchNexus Library API | Files | Library entry + TMDB metadata | No |

### 3.2 Data Model

**Rip Job Schema (stored in AppSettings as JSON):**
```json
{
  "id": "uuid",
  "status": "pending|scanning|ripping|transcoding|extracting|importing|complete|failed",
  "disc_type": "dvd|bluray|uhd",
  "disc_label": "MY_MOVIE_2024",
  "drive_index": 0,
  "drive_name": "/dev/sr0",
  "titles": [
    {
      "index": 0,
      "name": "title_t00.mkv",
      "duration": "2:15:30",
      "size_bytes": 27262976000,
      "resolution": "1920x1080",
      "chapters": 32,
      "selected": true,
      "streams": [
        { "index": 0, "type": "video", "codec": "H.264", "resolution": "1920x1080", "fps": "23.976" },
        { "index": 1, "type": "audio", "codec": "DTS-HD MA", "channels": "7.1", "language": "eng", "selected": true },
        { "index": 2, "type": "audio", "codec": "AC-3", "channels": "5.1", "language": "fra", "selected": false },
        { "index": 3, "type": "subtitle", "codec": "PGS", "language": "eng", "selected": true },
        { "index": 4, "type": "subtitle", "codec": "PGS", "language": "fra", "selected": false }
      ]
    }
  ],
  "transcode_profile": "1080p-h265-crf20",
  "output_format": "mkv",
  "output_path": "/media/rips/My Movie (2024)",
  "rip_progress": 67.5,
  "transcode_progress": 0.0,
  "eta_seconds": 1830,
  "started_at": "2026-03-24T13:00:00Z",
  "completed_at": null,
  "error": null
}
```

**Transcode Profile Schema:**
```json
{
  "id": "1080p-h265-crf20",
  "name": "1080p HEVC Quality",
  "video_encoder": "x265",
  "video_quality": 20,
  "video_preset": "medium",
  "hw_accel": "auto",
  "audio_config": [
    { "encoder": "aac", "bitrate": 192, "mixdown": "stereo" },
    { "encoder": "copy:ac3", "passthrough": true }
  ],
  "subtitle_mode": "all",
  "subtitle_burn": false,
  "output_format": "mkv"
}
```

### 3.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/strudel/status` | Module status + tool availability |
| GET | `/api/strudel/drives` | List optical drives with disc status |
| POST | `/api/strudel/scan` | Scan disc in specified drive (async) |
| GET | `/api/strudel/scan/{jobId}` | Get scan results |
| POST | `/api/strudel/rip` | Start rip job with title/stream selection |
| GET | `/api/strudel/jobs` | List all rip/transcode jobs |
| GET | `/api/strudel/jobs/{jobId}` | Get job status + progress |
| DELETE | `/api/strudel/jobs/{jobId}` | Cancel/remove job |
| POST | `/api/strudel/jobs/{jobId}/retry` | Retry failed job |
| GET | `/api/strudel/profiles` | List transcode profiles |
| POST | `/api/strudel/profiles` | Create custom transcode profile |
| PUT | `/api/strudel/profiles/{id}` | Update transcode profile |
| DELETE | `/api/strudel/profiles/{id}` | Delete transcode profile |
| GET | `/api/strudel/history` | Completed rip history |
| GET | `/api/strudel/config` | Module configuration |
| PUT | `/api/strudel/config` | Update module configuration |
| POST | `/api/strudel/eject/{driveIndex}` | Eject disc from drive |

### 3.4 Frontend UI Sections

**1. Drive Panel (top)**
- Shows detected optical drives (name, model, type)
- Disc status indicator (empty / DVD / Blu-ray / UHD BD)
- Scan button per drive
- Eject button

**2. Disc Info / Title Selection (main area)**
- After scan: list of titles with duration, size, chapter count
- Expandable title detail: video/audio/subtitle streams
- Checkboxes for title and stream selection
- Transcode profile dropdown
- Output format selector (MKV / MP4)
- "Start Rip" button

**3. Job Queue (sidebar/bottom)**
- Active jobs with real-time progress bars
- Status badges (Ripping → Transcoding → Extracting → Importing)
- ETA display
- Cancel/retry actions

**4. Profiles Tab**
- Preset transcode profiles (built-in + custom)
- Create/edit profile form:
  - Video: encoder, quality (CRF), preset (ultrafast→placebo), HW accel
  - Audio: encoder per track, bitrate, mixdown, passthrough options
  - Subtitles: mode (all/selected/none), burn-in option
  - Output: format, naming template

**5. History Tab**
- Completed rips with disc label, date, file sizes, library status
- Re-rip option

**6. Settings Tab**
- MakeMKV binary path
- HandBrake binary path
- Default output directory
- Default transcode profile
- Auto-scan on disc insert (toggle)
- Auto-rip main title (toggle)
- Auto-import to library (toggle)
- Minimum title length (seconds)
- Temporary file directory

---

## 4. Dependency Requirements

### 4.1 Required External Binaries

| Binary | Package | Purpose | Required? |
|--------|---------|---------|-----------|
| `makemkvcon` | MakeMKV (manual install) | Disc ripping + decryption | Yes |
| `HandBrakeCLI` | handbrake-cli | Transcoding | Yes (for transcode) |
| `mkvmerge` | mkvtoolnix | MKV inspection/muxing | Recommended |
| `mkvextract` | mkvtoolnix | Track extraction | Recommended |
| `ffprobe` | ffmpeg | Media file inspection | Recommended |
| `ffmpeg` | ffmpeg | Subtitle conversion | Recommended |
| `lsscsi` | lsscsi | Drive detection | Recommended |

### 4.2 Installation Commands (Debian/Ubuntu)
```bash
# HandBrake CLI
sudo apt install handbrake-cli

# MKVToolNix
sudo apt install mkvtoolnix

# FFmpeg
sudo apt install ffmpeg

# SCSI tools
sudo apt install lsscsi

# MakeMKV (manual - snap or PPA)
sudo snap install makemkv
# OR from PPA:
sudo add-apt-repository ppa:heyarje/makemkv-beta
sudo apt update && sudo apt install makemkv-bin makemkv-oss

# libdvdcss (for HandBrake direct DVD ripping)
sudo apt install libdvd-pkg
sudo dpkg-reconfigure libdvd-pkg
```

### 4.3 Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Optical Drive | Any USB/SATA DVD drive | LG/ASUS BD drive with LibreDrive firmware |
| RAM | +512 MB during rip | +2 GB during transcode |
| Temp Storage | 2x disc size (SSD preferred) | NVMe SSD for rip speed |
| HW Encoder | None (CPU fallback) | Intel QSV / NVIDIA NVENC |

---

## 5. Legal Considerations

### 5.1 DMCA & International Law

Disc ripping involves circumventing copy protection mechanisms (CSS for DVD, AACS/BD+ for Blu-ray), which raises legal considerations:

- **United States (DMCA):** Circumventing technological protection measures is prohibited under Section 1201, even for personal backups. However, enforcement against private, non-commercial use is extremely rare. The 2021 triennial exemption permits circumvention for preserving lawfully acquired media from obsolescence, with restrictions (local-only, encrypted storage).

- **European Union:** The Computer Programs Directive and national implementations vary. Some countries (e.g., UK) allow personal backup copies; others (e.g., Germany) restrict circumvention. The InfoSoc Directive's anti-circumvention provisions apply but personal use exemptions exist in some member states.

- **Canada:** Personal backup copies are generally permitted under fair dealing provisions.

- **Australia:** Circumvention for personal use of legally purchased media is permitted under the Copyright Amendment (2006).

### 5.2 WatchNexus Position

WatchNexus does **not** include or distribute any decryption libraries or copy protection circumvention tools. The Strudel module integrates with **user-installed** third-party tools (MakeMKV, HandBrake) that are independently developed and distributed. WatchNexus provides a management interface only.

**Required disclaimer in module UI:**
> "Strudel requires user-installed third-party tools. Users are responsible for ensuring compliance with applicable laws in their jurisdiction. WatchNexus does not provide, distribute, or endorse tools for circumventing copy protection."

---

## 6. Implementation Phases

### Phase 1: Foundation (Current Sprint)
- [x] Investigation document
- [x] Backend controller scaffold (StrudelController.cs)
- [x] Frontend page scaffold (StrudelPage.jsx)
- [x] Module status endpoint
- [x] Drive detection endpoint
- [x] Disc scan endpoint (makemkvcon wrapper)
- [x] Default transcode profiles

### Phase 2: Ripping Pipeline
- [ ] Job queue system with async processing
- [ ] MakeMKV process management (start, monitor, cancel)
- [ ] Robot mode output parser (PRGV progress, TINFO metadata)
- [ ] Real-time progress WebSocket/SSE endpoint
- [ ] Temporary file management

### Phase 3: Transcoding Pipeline
- [ ] HandBrake CLI process wrapper
- [ ] Custom preset management (JSON export/import)
- [ ] Hardware acceleration detection and configuration
- [ ] Multi-audio track handling
- [ ] Subtitle extraction and conversion (PGS → SRT via OCR)

### Phase 4: Library Integration
- [ ] Auto-import ripped/transcoded files into Marmalade library
- [ ] TMDB metadata lookup from disc label/title
- [ ] Automatic naming: "Movie Title (Year)/Movie Title (Year).mkv"
- [ ] Chapter marker preservation
- [ ] Subtitle file placement (sidecar .srt files)

### Phase 5: Automation
- [ ] udev event monitoring for disc insertion
- [ ] Auto-scan on disc insert
- [ ] Auto-rip main title (longest by duration)
- [ ] Auto-transcode with default profile
- [ ] Auto-eject on completion
- [ ] Notification system (via existing WatchNexus notifications)

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| MakeMKV not installed | Medium | Graceful degradation — show install instructions |
| Drive permissions (Linux) | Medium | Document udev rule setup, check `/dev/sr*` access |
| Large temp file space | Medium | Pre-check available space, configurable temp dir |
| Long rip/transcode times | Low | Background processing, progress tracking, cancelation |
| Protected disc failures | Low | Error handling, retry logic, user guidance |
| HandBrake preset compatibility | Low | Ship default presets, validate on load |

---

## 8. References

- MakeMKV CLI documentation: https://www.makemkv.com/developers/usage.txt
- MakeMKV attribute IDs: `apdefs.h` in MakeMKV source
- HandBrake CLI reference: https://handbrake.fr/docs/en/latest/cli/command-line-reference.html
- HandBrake presets: https://handbrake.fr/docs/en/latest/advanced/custom-presets.html
- Automatic Ripping Machine: https://github.com/automatic-ripping-machine/automatic-ripping-machine
- MKVToolNix: https://mkvtoolnix.download/
- libdvdcss: https://www.videolan.org/developers/libdvdcss.html
- libbluray: https://www.videolan.org/developers/libbluray.html

---

*Document created: April 8, 2026 | Module: Strudel v2.8.4*
