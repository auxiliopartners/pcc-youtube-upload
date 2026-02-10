# YouTube Bulk Upload Script - Claude Code Prompt

## Project Overview

Build a Node.js CLI application to bulk upload ~1,000 sermon videos from a Google Shared Drive to a YouTube brand account. The script must handle metadata mapping, thumbnail uploads, playlist creation, quota management, and resumable operation across multiple days.

## Environment & Preferences

- **Runtime**: Node.js with ES modules (`"type": "module"` in package.json)
- **Package Manager**: Yarn (not npm)
- **Linting**: xo
- **Editor**: VSCode (include `.vscode/settings.json` for xo integration)

## Data Source: Google Shared Drive

**Shared Drive ID**: `0ADp1d22rJVx5Uk9PVA`

### Directory Structure
```
/
├── manifest.json          # Root manifest with all items
├── library.json           # Detailed metadata (speaker, scriptures, summary)
├── series.json            # Series/playlist definitions
└── {folder}/              # One folder per media item
    ├── manifest.json      # Per-item manifest (optional, mirror of root)
    ├── {slug}-wide.jpg    # Thumbnail options (use image_wide for YouTube)
    ├── {slug}-square.jpg
    ├── {slug}-banner.jpg
    ├── {slug}-thumb-01.jpg through {slug}-thumb-10.jpg  # Video thumbnails
    └── {slug}-original.mp4 or .mov  # Video file (key: video_original)
```

### Root manifest.json Structure
```json
{
  "version": "1.0.0",
  "items": {
    "{uuid}": {
      "title": "The God Who Redeems",
      "date": "2025-12-21T00:00:00Z",
      "slug": "the-god-who-redeems",
      "folder": "2025-12-21-the-god-who-redeems",
      "series": {
        "id": "08134fcc-69eb-43fe-81ef-e099260caaa3",
        "title": "Come and Behold Him",
        "slug": "come-and-behold-him",
        "position": 4
      },
      "status": "complete",
      "files": {
        "image_wide": {
          "type": "image_wide",
          "filename": "the-god-who-redeems-wide.png",
          "status": "complete"
        },
        "video_original": {
          "type": "video_original",
          "filename": "the-god-who-redeems-original.mp4",
          "expectedSize": 4898653995,
          "status": "complete"
        },
        "thumbnail_01": { ... }  // Video frame thumbnails
      }
    }
  }
}
```

**Critical**: Only items with `files.video_original` should be uploaded. Items without this key are audio-only or images and should be skipped.

### library.json Structure (for descriptions)
```json
[
  {
    "id": "uuid-matching-manifest",
    "title": "The God Who Redeems",
    "speaker": "Alex Watlington",
    "tags": ["speaker:Alex Watlington"],
    "scriptures": ["Isa.7.10-Isa.7.17"],
    "summary": "<p>Optional HTML description</p>",
    "_embedded": {
      "media-series": {
        "id": "series-uuid",
        "title": "Come and Behold Him"
      }
    }
  }
]
```

### series.json Structure (for playlists)
```json
[
  {
    "id": "a55d90ac-f989-4309-9889-15d3d2e1392c",
    "title": "Vision: Gospel, Church + the City",
    "slug": "vision-gospel-church-the-city",
    "subtitle": "CURRENT Series",
    "media_items_count": 3
  }
]
```

## YouTube API Configuration

### Authentication
- Use OAuth 2.0 with offline access for refresh tokens
- Store credentials in `credentials.json` (client_id, client_secret from Cloud Console)
- Store tokens in `tokens.json` (access_token, refresh_token)
- Must support selecting a **brand account** during OAuth flow (the channel is managed under a brand account, not the user's personal channel)
- Implement token refresh logic

### API Quota Constraints (CRITICAL)
Default quota: **10,000 units/day** (resets at midnight Pacific Time)

| Operation | Cost (units) |
|-----------|--------------|
| videos.insert (upload) | 1,600 |
| thumbnails.set | 50 |
| playlists.insert | 50 |
| playlistItems.insert | 50 |
| videos.list / playlists.list | 1 |

**Per video with thumbnail**: 1,650 units
**Daily capacity**: ~6 videos/day with thumbnails at default quota

### Privacy Setting
All videos should be uploaded as **`private`** (not public or unlisted). This avoids the API compliance audit requirement for unverified apps.

## Required Features

### 1. OAuth Flow with Brand Account Support
```javascript
// During OAuth, prompt user to select channel if multiple are available
// Use YouTube Data API channels.list with mine=true to get available channels
// Store selected channel ID for subsequent operations
```

### 2. Manifest Loading
- Load `manifest.json`, `library.json`, and `series.json` from Shared Drive root
- Build lookup maps:
  - `libraryById`: Map item UUID → library entry (for speaker, scriptures, summary)
  - `seriesById`: Map series UUID → series entry
- Filter items to only those with `files.video_original` present and `status: "complete"`

### 3. Video Metadata Mapping
For each video, construct YouTube metadata:

```javascript
{
  snippet: {
    title: item.title,  // From manifest
    description: buildDescription(item, libraryEntry),
    tags: buildTags(libraryEntry),
    categoryId: "29"  // Nonprofits & Activism (or "22" for People & Blogs)
  },
  status: {
    privacyStatus: "private",
    selfDeclaredMadeForKids: false
  },
  recordingDetails: {
    recordingDate: item.date  // ISO 8601 date
  }
}
```

**Description Builder**:
```javascript
function buildDescription(item, libraryEntry) {
  const parts = [];
  
  // Series info
  if (item.series?.title) {
    parts.push(`Part of the "${item.series.title}" series`);
  }
  
  // Speaker
  if (libraryEntry?.speaker) {
    parts.push(`Speaker: ${libraryEntry.speaker}`);
  }
  
  // Scripture references
  if (libraryEntry?.scriptures?.length) {
    parts.push(`Scripture: ${libraryEntry.scriptures.join(", ")}`);
  }
  
  // Summary (strip HTML tags)
  if (libraryEntry?.summary) {
    const plainText = libraryEntry.summary.replace(/<[^>]*>/g, '').trim();
    if (plainText) parts.push(`\n${plainText}`);
  }
  
  // Add church info footer (customize as needed)
  parts.push("\n---\nYour Church Name | yourchurch.org");
  
  return parts.join("\n");
}
```

### 4. Thumbnail Selection Logic
Priority order for thumbnail:
1. `files.image_wide` (1920x1080 ideal for YouTube)
2. `files.image_banner` (fallback)
3. `files.thumbnail_01` (video frame thumbnail)

YouTube thumbnail requirements:
- Max 2MB file size
- Formats: JPG, GIF, PNG
- Recommended: 1280x720 (16:9 aspect ratio)

### 5. Resumable Upload Implementation
Use YouTube's resumable upload protocol for large video files:

```javascript
// 1. Initialize resumable upload session
const initResponse = await youtube.videos.insert({
  part: ['snippet', 'status', 'recordingDetails'],
  notifySubscribers: false,
  requestBody: metadata,
  media: {
    body: fs.createReadStream(videoPath)
  }
}, {
  // Enable resumable uploads
  onUploadProgress: (evt) => {
    const progress = (evt.bytesRead / fileSize) * 100;
    console.log(`Upload progress: ${progress.toFixed(1)}%`);
  }
});
```

For files >100MB, use chunked resumable uploads with the ability to resume from failure point.

### 6. State Management
Create `upload-state.json` to track progress:

```json
{
  "startedAt": "2025-01-30T10:00:00Z",
  "updatedAt": "2025-01-30T15:30:00Z",
  "quotaUsedToday": 8250,
  "quotaResetDate": "2025-01-31",
  "playlists": {
    "series-uuid-1": {
      "youtubePlaylistId": "PLxxxxxxxxx",
      "title": "Come and Behold Him",
      "createdAt": "2025-01-30T10:05:00Z"
    }
  },
  "videos": {
    "item-uuid-1": {
      "status": "complete",
      "youtubeVideoId": "dQw4w9WgXcQ",
      "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
      "uploadedAt": "2025-01-30T10:30:00Z",
      "thumbnailUploaded": true,
      "addedToPlaylist": true
    },
    "item-uuid-2": {
      "status": "uploading",
      "resumeUri": "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=xxx",
      "bytesUploaded": 1073741824
    },
    "item-uuid-3": {
      "status": "pending"
    }
  }
}
```

### 7. Playlist Management
1. On startup, create all playlists from `series.json` that don't exist yet
2. After each video upload, add it to the corresponding playlist
3. Track playlist membership in state

```javascript
// Create playlist
const playlist = await youtube.playlists.insert({
  part: ['snippet', 'status'],
  requestBody: {
    snippet: {
      title: series.title,
      description: series.subtitle || `Videos from the "${series.title}" series`
    },
    status: {
      privacyStatus: 'private'
    }
  }
});

// Add video to playlist (use position from manifest for ordering)
await youtube.playlistItems.insert({
  part: ['snippet'],
  requestBody: {
    snippet: {
      playlistId: playlistId,
      resourceId: {
        kind: 'youtube#video',
        videoId: videoId
      },
      position: item.series?.position  // Optional: maintain order
    }
  }
});
```

### 8. Quota Management & Continuous Operation
```javascript
const DAILY_QUOTA = 10000;
const UPLOAD_COST = 1600;
const THUMBNAIL_COST = 50;
const PLAYLIST_ITEM_COST = 50;
const VIDEO_TOTAL_COST = UPLOAD_COST + THUMBNAIL_COST + PLAYLIST_ITEM_COST; // 1700

async function canUploadMore(state) {
  // Check if quota reset (midnight Pacific)
  const now = new Date();
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const resetDate = pacific.toISOString().split('T')[0];
  
  if (state.quotaResetDate !== resetDate) {
    state.quotaUsedToday = 0;
    state.quotaResetDate = resetDate;
  }
  
  return state.quotaUsedToday + VIDEO_TOTAL_COST <= DAILY_QUOTA;
}

async function runContinuously() {
  while (true) {
    const state = loadState();
    
    if (!await canUploadMore(state)) {
      const msUntilReset = getMsUntilMidnightPacific();
      console.log(`Daily quota exhausted. Sleeping until ${new Date(Date.now() + msUntilReset).toISOString()}`);
      await sleep(msUntilReset + 60000); // Add 1 minute buffer
      continue;
    }
    
    const nextVideo = getNextPendingVideo(state);
    if (!nextVideo) {
      console.log('All videos uploaded!');
      break;
    }
    
    await uploadVideo(nextVideo, state);
    
    // Small delay between uploads to avoid rate limiting
    await sleep(5000);
  }
}
```

### 9. Error Handling & Retry Logic
```javascript
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 30000, 120000]; // 5s, 30s, 2min

async function withRetry(fn, context) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.response?.status === 500 ||
        error.response?.status === 503 ||
        (error.response?.status === 403 && 
         error.response?.data?.error?.errors?.[0]?.reason === 'rateLimitExceeded');
      
      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        throw error;
      }
      
      console.log(`Retry ${attempt + 1}/${MAX_RETRIES} for ${context} in ${RETRY_DELAYS[attempt]}ms`);
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
}
```

### 10. Final Report Generation
After completion (or on demand), generate `upload-report.json`:

```json
{
  "generatedAt": "2025-02-15T10:00:00Z",
  "summary": {
    "totalVideos": 1000,
    "uploaded": 1000,
    "failed": 0,
    "playlists": 45
  },
  "videos": [
    {
      "itemId": "uuid",
      "title": "The God Who Redeems",
      "youtubeVideoId": "dQw4w9WgXcQ",
      "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
      "playlistId": "PLxxxxxxxxx",
      "uploadedAt": "2025-01-30T10:30:00Z"
    }
  ]
}
```

## CLI Interface

```bash
# First-time setup - run OAuth flow
yarn start auth

# Start/resume upload process (runs continuously)
yarn start upload

# Generate report from current state
yarn start report

# Check quota status
yarn start status

# Upload a single video by item ID (for testing)
yarn start upload --item uuid-here

# Dry run - validate manifest and show what would be uploaded
yarn start upload --dry-run
```

## File Structure

```
youtube-bulk-upload/
├── package.json
├── .xo-config.json
├── .vscode/
│   └── settings.json
├── src/
│   ├── index.js           # CLI entry point
│   ├── auth.js            # OAuth flow with brand account support
│   ├── drive.js           # Google Drive API client (Shared Drive support)
│   ├── youtube.js         # YouTube API client wrapper
│   ├── manifest.js        # Load and parse manifest files
│   ├── metadata.js        # Build YouTube metadata from manifest
│   ├── upload.js          # Upload orchestration
│   ├── playlists.js       # Playlist creation and management
│   ├── state.js           # State persistence
│   ├── quota.js           # Quota tracking and management
│   └── report.js          # Report generation
├── credentials.json       # OAuth client credentials (gitignored)
├── tokens.json            # OAuth tokens (gitignored)
└── upload-state.json      # Upload progress state (gitignored)
```

## Dependencies

```json
{
  "dependencies": {
    "googleapis": "^140.0.0",
    "commander": "^12.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.0.0"
  },
  "devDependencies": {
    "xo": "^0.59.0"
  }
}
```

## Google Cloud Console Setup Instructions

Include a `SETUP.md` file with:

1. Create project in Google Cloud Console
2. Enable YouTube Data API v3 and Google Drive API
3. Configure OAuth consent screen (Internal or External - for brand account, may need External)
4. Add scopes:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/drive.readonly`
5. Create OAuth 2.0 credentials (Desktop app type)
6. Download JSON and save as `credentials.json`

## Important Notes for Implementation

1. **Shared Drive Access**: When using Google Drive API, always include `supportsAllDrives: true` and `driveId` parameters for Shared Drive access.

2. **Video File Streaming**: Don't download entire videos to local disk. Stream directly from Drive to YouTube using resumable uploads.

3. **Rate Limiting**: Beyond quota, YouTube may rate-limit requests. Implement exponential backoff.

4. **Large Files**: Some videos are 4-5GB. Use chunked uploads with progress tracking.

5. **Idempotency**: If a video upload fails partway through, the resumable upload URI should be saved to state for retry.

6. **Timezone**: Quota resets at midnight **Pacific Time**, not UTC. Account for this in quota calculations.

7. **Brand Account**: The OAuth flow must allow selecting a brand channel. Use `channels.list` with `mine=true` after initial auth to let user pick which channel to upload to.

8. **Thumbnail Timing**: Thumbnails can only be set after the video is fully uploaded and processed. May need to poll video status before setting thumbnail.
