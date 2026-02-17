# PCC YouTube Upload CLI - Screencast Script

Recording guide for the YouTube API quota extension form submission. Target length: ~5 minutes.

---

## Scene 1: Introduction (30s)

**Show:** Terminal with the project directory open.

**Narration:**
> This is the PCC YouTube Upload CLI, a tool built by Pacific Crossroads Church to upload our sermon video archive to YouTube. We have 505 sermon videos stored on a Google Shared Drive that we need to migrate to our YouTube channel with custom thumbnails. The tool uses the YouTube Data API v3 for uploads and thumbnail setting.

**Commands to run:**
```bash
node src/index.js --version
node src/index.js --help
```

**Expected output:**
```
1.0.0

Usage: pcc-youtube-upload [options] [command]

Upload a sermon media archive to Youtube

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  auth                Run OAuth 2.0 authentication flow
  upload [options]    Start or resume the upload process
  status              Show current quota and upload status
  report              Generate upload report from current state
  help [command]      display help for a specific command
```

---

## Scene 2: Project Structure (30s)

**Show:** File listing of the `src/` directory.

**Narration:**
> The project is organized into focused modules. The main entry point is index.js which defines the CLI commands. Auth handles OAuth 2.0 with credentials stored securely in 1Password. Drive handles streaming files from our Shared Drive. YouTube wraps the API client with retry logic. Metadata builds the video title, description, and tags. Upload manages the main upload loop with quota-aware sleeping. Quota tracks our daily API usage. State persists progress to disk so we can resume if interrupted.

**Commands to run:**
```bash
ls -la src/
```

**Expected output:**
```
auth.js       - OAuth 2.0 authentication, token management
drive.js      - Google Drive file streaming
index.js      - CLI entry point and command definitions
manifest.js   - Load and filter manifest data from Drive
metadata.js   - Build video titles, descriptions, tags
quota.js      - Daily quota tracking and enforcement
report.js     - Upload progress report generation
state.js      - State persistence and resumption
upload.js     - Main upload loop with retry logic
youtube.js    - YouTube API client initialization and helpers
```

---

## Scene 3: Authentication (45s)

**Show:** The auth flow (or describe it if you don't want to show real credentials).

**Narration:**
> The auth command retrieves our OAuth client credentials from 1Password at runtime — they're never stored in source code or config files. It opens a browser for Google's OAuth consent screen and starts a local server on port 3000 to receive the callback. After authorization, it lets us select which channel to upload to, which is important for brand account support. The tokens are saved locally and auto-refreshed on subsequent runs.

**Option A - Live demo:**
```bash
node src/index.js auth
```
Then walk through the browser consent flow and channel selection.

**Option B - Show the code instead:**
Open `src/auth.js` and highlight:
- Lines 15-19: OAuth scopes (youtube.upload, youtube, drive.readonly)
- Lines 24-41: 1Password credential retrieval
- Lines 105-144: Channel selection for brand accounts
- Lines 208-216: Automatic token refresh listener

---

## Scene 4: Status Check (30s)

**Show:** Output of the status command.

**Narration:**
> The status command shows our current quota usage and upload progress at a glance. It shows how many API units we've used today, how many remain, and how many videos we can still upload today within the quota. Below that, it shows the overall upload progress — how many videos are complete, pending, or failed.

**Command:**
```bash
node src/index.js status
```

**Expected output:**
```
--- Quota Status ---
  Daily quota:      10000 units
  Used today:       0 units
  Remaining:        10000 units
  Videos remaining: 5 today
  Reset date:       N/A

--- Upload Status ---
  Complete:   0
  Failed:     0
  Uploading:  0
  Pending:    0
```

---

## Scene 5: Dry Run (60s)

**Show:** Dry run output showing what would be uploaded.

**Narration:**
> The dry-run flag lets us preview exactly what will be uploaded without making any API calls. For each pending video, it shows the title, date, video filename, thumbnail, series, and speaker. At the end, it summarizes how many videos are pending and estimates how many days it will take at the current quota. This is useful for validating the manifest data before committing to actual uploads.

**Command:**
```bash
node src/index.js upload --dry-run
```

**Expected output (first few items):**
```
--- DRY RUN ---

  [pending] The King's Arrival
         Date: 2013-12-01
         Video: 12-01-13 Dave Lomas Sermon.mp4
         Thumbnail: 12-01-13_wide.jpg
         Series: Advent 2013
         Speaker: Dave Lomas

  [pending] Waiting for Peace
         Date: 2013-12-08
         Video: 12-08-13 Dave Lomas Sermon.mp4
         Thumbnail: 12-08-13_wide.jpg
         Series: Advent 2013
         Speaker: Dave Lomas

  ... (hundreds more)

Summary: 466 to upload, 0 already done, 0 previously failed
Estimated days at 6 videos/day: 78

--- END DRY RUN ---
```

**Point out:** "At 6 videos per day, this would take 78 days — that's why we need the quota increase."

---

## Scene 6: Single Video Upload Demo (60s)

**Show:** Upload a single video to demonstrate the full pipeline.

**Narration:**
> Now let me show a real upload. Using the --item flag, we can upload a single video to demonstrate the complete pipeline. Watch the steps: first it streams the video from our Shared Drive and uploads it to YouTube with all the metadata. You can see the upload progress percentage. Then it sets the custom thumbnail. Finally, it saves the state and generates a report.

**Command:**
```bash
node src/index.js upload --item <pick-an-item-id>
```

**Expected output:**
```
  Upload progress: 100.0% (1.2 GB / 1.2 GB)

Done! Uploaded 1 videos with 0 errors.

Report generated: 1 uploaded, 0 failed, 465 pending
```

**After the upload, show the status:**
```bash
node src/index.js status
```

**Expected output:**
```
--- Quota Status ---
  Daily quota:      10000 units
  Used today:       1650 units
  Remaining:        8350 units
  Videos remaining: 5 today
  Reset date:       2025-02-11

--- Upload Status ---
  Complete:   1
  Failed:     0
  Uploading:  0
  Pending:    0
```

**Point out:** "Notice the quota tracker — that one upload used exactly 1,650 units: 1,600 for the video and 50 for the thumbnail."

---

## Scene 7: Quota Management (30s)

**Show:** The quota constants in the code and the status output.

**Narration:**
> The tool tracks every API unit spent. Here in quota.js you can see the cost constants — 1,600 for a video upload and 50 for a thumbnail. The tool checks before each upload whether it can afford the full 1,650-unit cost. If the daily quota is exhausted, it automatically sleeps until midnight Pacific time and resumes. This means we can start the tool and let it run unattended — it will upload as many videos as the quota allows each day and pause overnight.

**Show:** Open `src/quota.js` and highlight the cost constants and the `canUploadMore` function.

---

## Scene 8: State & Resumption (30s)

**Show:** The upload-state.json file.

**Narration:**
> All progress is saved to upload-state.json after every single operation. If the tool crashes, loses network, or is stopped manually, it picks up exactly where it left off on the next run. Each video tracks its status through the pipeline — pending, uploading, uploaded, and finally complete. Failed uploads are recorded with the error message and can be retried.

**Command:**
```bash
cat upload-state.json | head -30
```

**Show a few entries in the videos object, pointing out the status fields.**

---

## Scene 9: Wrap-up (15s)

**Narration:**
> To summarize: this is a purpose-built tool for a one-time migration of 505 sermon videos to YouTube. It uses the YouTube Data API responsibly — single-threaded, rate-limited, with full quota tracking. Once the archive upload is complete, our ongoing API usage will return to near-zero. The quota increase we're requesting will let us complete this migration in about two weeks instead of three months.

---

## Recording Tips

- **Resolution:** 1920x1080 or higher
- **Terminal font:** Use a large, readable font (16pt+) so text is legible in the video
- **Speed:** Pause briefly after each command so the viewer can read the output
- **Video uploads:** The single-item demo upload will take a few minutes depending on file size. You can speed up or cut that section in editing.
- **Sensitive data:** The auth flow will show your Google account — you may want to blur email addresses. Token values in tokens.json should not be shown.
- **Total length:** Aim for about 5 minutes. Google reviewers are watching many of these — keep it concise.
