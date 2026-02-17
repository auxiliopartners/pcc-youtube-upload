# PCC YouTube Upload CLI - Design Document

## 1. Project Overview

**Organization:** Pacific Crossroads Church (501(c)(3) nonprofit, Los Angeles, CA)
**Project:** PCC YouTube Upload CLI
**Google Cloud Project Number:** 150130945051
**Purpose:** One-time bulk upload of a sermon video archive to YouTube

Pacific Crossroads Church maintains an archive of sermon recordings on a Google Shared Drive. This CLI tool automates uploading 505 sermon videos to the church's YouTube channel, organized into 72 series-based playlists with custom thumbnails. The tool is designed for a single migration project and will not be used for ongoing operations once the archive upload is complete.

### Scope

| Item          | Count |
|---------------|-------|
| Videos        | 505   |
| Playlists     | 72    |
| Thumbnails    | 505   |

## 2. Architecture Overview

```
+------------------+       +---------------------+       +------------------+
|  Google Shared   |       |  PCC YouTube Upload  |       |  YouTube Data    |
|  Drive           |       |  CLI (Node.js)       |       |  API v3          |
|                  |       |                      |       |                  |
|  manifest.json --+------>|  1. Load manifests   |       |                  |
|  library.json  --+------>|  2. Filter & sort    |       |                  |
|  series.json   --+------>|  3. Auth (OAuth 2.0) |       |                  |
|                  |       |                      |       |                  |
|  /[folder]/    --+------>|  4. For each video:  |       |                  |
|   video.mp4      |stream |   a. Stream video  --+------>|  videos.insert   |
|   thumbnail.jpg  |       |   b. Set thumbnail --+------>|  thumbnails.set  |
|                  |       |   c. Add to playlist-+------>|  playlistItems   |
|                  |       |                      |       |     .insert      |
+------------------+       |  5. Track state      |       |                  |
                           |     (JSON on disk)   |       |                  |
                           |                      |       |                  |
  +----------------+       |  6. Track quota      |       |                  |
  |  1Password     |       |     (daily limit)    |       |                  |
  |  (credentials) +------>|                      |       |                  |
  +----------------+       +---------------------+       +------------------+
                                     |
                                     v
                           +---------------------+
                           |  Local State Files   |
                           |                      |
                           |  upload-state.json   |
                           |  tokens.json         |
                           |  upload-report.json  |
                           +---------------------+
```

## 3. Authentication Flow

The tool uses **OAuth 2.0** with the following scopes:

- `youtube.upload` - Upload videos
- `youtube` - Manage playlists and thumbnails
- `drive.readonly` - Read manifests and video files from Shared Drive

**Credential storage:** OAuth client ID and secret are stored in **1Password** and retrieved at runtime via the 1Password SDK. They are never written to disk or committed to source control.

**Token lifecycle:**
1. First run: `auth` command opens a browser for Google OAuth consent, starts a local HTTP server on port 3000 to receive the callback
2. User selects a channel (supports brand accounts via `channels.list`)
3. Tokens (access + refresh) are saved to `tokens.json` (gitignored)
4. Subsequent runs: tokens are loaded from disk, auto-refreshed when expired via an `oauth2Client.on('tokens')` listener

## 4. Data Sources

Three JSON manifest files are loaded from Google Shared Drive at the start of each run:

| File            | Contents                                           |
|-----------------|----------------------------------------------------|
| manifest.json   | All media items with file references and status    |
| library.json    | Metadata: speaker, scriptures, tags, summaries     |
| series.json     | Series definitions with titles, subtitles, images  |

**Filtering:** Only items where `files.video_original` exists AND `status === 'complete'` are selected for upload (466 of 1,176 total items currently ready; up to 505 total have video content).

**Sorting:** Items are sorted by date ascending (oldest sermons uploaded first).

## 5. Upload Pipeline

For each video, the tool performs these steps sequentially:

```
 1. Check quota          Can we afford 1,700 units?
        |                     |
        | no                  | yes
        v                     v
 Sleep until midnight    2. Stream video from Google Drive
 Pacific, then retry           |
                               v
                         3. youtube.videos.insert
                            (1,600 units)
                            - title, description, tags
                            - category: Nonprofits & Activism
                            - privacy: private
                            - recording date from manifest
                               |
                               v
                         4. youtube.thumbnails.set
                            (50 units)
                            - priority: image_wide > image_banner > thumbnail_01
                               |
                               v
                         5. youtube.playlistItems.insert
                            (50 units)
                            - adds video to its series playlist
                               |
                               v
                         6. Save state to disk
                               |
                               v
                         7. Sleep 5 seconds
                               |
                               v
                         Next video...
```

**Video metadata constructed per upload:**
- **Title:** Sermon title from manifest
- **Description:** Series name, speaker, scripture references, summary text, church footer
- **Tags:** "sermon", "church", "Pacific Crossroads Church", speaker name, scripture references, custom tags
- **Category ID:** 29 (Nonprofits & Activism)
- **Privacy:** Private (can be changed to public manually after review)
- **Recording date:** Original sermon date
- **Subscriber notification:** Disabled (`notifySubscribers: false`)

## 6. YouTube API Usage

| API Method                    | Cost (units) | When Used                       | Frequency         |
|-------------------------------|-------------|----------------------------------|--------------------|
| `youtube.videos.insert`       | 1,600       | Upload each video                | 505 times          |
| `youtube.thumbnails.set`      | 50          | Set thumbnail per video          | 505 times          |
| `youtube.playlistItems.insert`| 50          | Add video to series playlist     | 505 times          |
| `youtube.playlists.insert`    | 50          | Create series playlist           | 72 times           |
| `youtube.playlistImages.insert`| 50         | Set playlist cover image         | 72 times           |
| `youtube.playlists.list`      | 1           | Check for existing playlists     | ~2-4 times (paged) |
| `youtube.channels.list`       | 1           | Select brand account (auth only) | 1 time             |

**Total estimated API cost:** ~866,000 units

**No read-heavy operations:** The tool does not poll, scrape, or repeatedly read YouTube data. All list operations are one-time checks at startup to avoid creating duplicate playlists.

## 7. Quota Management

The tool tracks quota usage locally and respects the daily limit:

**Constants (from `src/quota.js`):**
- `DAILY_QUOTA`: 10,000 units (will be updated if quota increase is granted)
- `VIDEO_TOTAL_COST`: 1,700 units (upload + thumbnail + playlist add)

**Tracking:**
- `quotaUsedToday` counter incremented after each API call
- `quotaResetDate` stores the current date in Pacific timezone (America/Los_Angeles)
- When a new day is detected, `quotaUsedToday` resets to 0

**Daily limit enforcement:**
- Before each upload, `canUploadMore()` checks if 1,700 units remain
- If quota is exhausted, the tool calculates milliseconds until midnight Pacific and sleeps
- Adds a 60-second buffer after midnight before resuming

**Rate limiting:**
- 5-second delay between consecutive uploads
- Single-threaded: only one API call in flight at a time
- Peak QPS: 1

## 8. State Management

All state is persisted to `upload-state.json` after every operation:

```
upload-state.json
{
  "startedAt": "2025-01-15T...",
  "updatedAt": "2025-01-15T...",
  "quotaUsedToday": 8500,
  "quotaResetDate": "2025-01-15",
  "playlists": {
    "<seriesId>": {
      "youtubePlaylistId": "PLxxxxx",
      "title": "Series Name",
      "createdAt": "...",
      "thumbnailSet": true
    }
  },
  "videos": {
    "<itemId>": {
      "status": "complete",        // pending | uploading | uploaded | complete | failed
      "youtubeVideoId": "dQw4...",
      "youtubeUrl": "https://youtu.be/dQw4...",
      "uploadedAt": "...",
      "thumbnailUploaded": true,
      "addedToPlaylist": true
    }
  }
}
```

**Resumption:** On restart, `getNextPendingItem()` finds the first item with status `pending` or `uploading` and continues from there. No work is repeated.

**Partial failure handling:** If a video uploads but the thumbnail or playlist add fails, the video is still marked `complete` with `thumbnailUploaded: false` or `addedToPlaylist: false`. The `fix-playlists` command can retry failed playlist additions later.

## 9. Error Handling

**Retry logic (from `src/youtube.js`):**
- Max retries: 3
- Backoff delays: 5s, 30s, 120s
- Retryable errors: `ECONNRESET`, `ETIMEDOUT`, `EPIPE`, HTTP 500, HTTP 503, HTTP 403 with `rateLimitExceeded` reason

**Non-retryable errors:** The video is marked `failed` in state with the error message, and the tool moves to the next video.

**Dry-run mode:** `--dry-run` flag validates the manifest and shows what would be uploaded without making any API calls or persisting state changes.

## 10. Security

- **Credentials:** OAuth client ID and secret are stored in 1Password and fetched at runtime via the 1Password SDK. They are never stored in source code or config files.
- **Tokens:** OAuth access and refresh tokens are stored in `tokens.json`, which is listed in `.gitignore` and never committed.
- **Environment variables:** Sensitive values (`OP_SERVICE_ACCOUNT_TOKEN`) are loaded from `.env` (also gitignored).
- **Privacy:** All videos are uploaded as **private**. They can be reviewed and made public manually afterward.
- **Shared Drive access:** The tool uses `drive.readonly` scope — it can only read files, never modify or delete them.
- **No public-facing surface:** The tool is a CLI run locally by an administrator. The only network listener is a temporary HTTP server on localhost:3000 during the initial OAuth flow.

## 11. CLI Commands

| Command          | Description                                            |
|------------------|--------------------------------------------------------|
| `auth`           | Run OAuth 2.0 flow, select channel, save tokens       |
| `upload`         | Start or resume bulk upload                            |
| `upload --item <id>` | Upload a single video by manifest ID              |
| `upload --dry-run` | Preview what would be uploaded without making changes|
| `status`         | Show current quota usage and upload progress           |
| `playlists`      | Create/sync playlists from series data                 |
| `fix-playlists`  | Retry adding videos to playlists that previously failed|
| `report`         | Generate JSON report of upload progress                |

## 12. Dependencies

| Package                | Version | Purpose                                |
|------------------------|---------|----------------------------------------|
| `@googleapis/youtube`  | 20.0.0  | YouTube Data API v3 client             |
| `@googleapis/drive`    | 8.0.0   | Google Drive API v3 client             |
| `google-auth-library`  | 9.0.0   | OAuth 2.0 authentication              |
| `@1password/sdk`       | 0.3.1   | Secure credential retrieval            |
| `commander`            | 14.0.3  | CLI argument parsing                   |
| `chalk`                | 5.6.2   | Terminal colored output                |
| `pino`                 | 10.1.0  | Structured JSON logging                |
| `sharp`                | 0.34.5  | Image resizing (playlist thumbnails)   |
| `dotenv`               | 17.2.3  | Environment variable loading (dev)     |
