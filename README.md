# PCC YouTube Upload

Bulk upload a sermon video archive from Google Shared Drive to YouTube. Streams video files directly from Drive to YouTube, creates playlists from sermon series, sets thumbnails, and tracks progress across multi-day runs with automatic quota management.

## Prerequisites

- Node.js >= 20.0.0
- Yarn 4 (via corepack)
- A Google Cloud project with YouTube Data API v3 and Google Drive API enabled
- A 1Password service account for credential storage

See [SETUP.md](SETUP.md) for full Google Cloud Console and 1Password configuration steps.

## Quick Start

```bash
# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Edit .env with your OP_SERVICE_ACCOUNT_TOKEN

# Authenticate with Google (opens browser)
yarn start auth

# Preview what will be uploaded
yarn start upload --dry-run

# Start uploading
yarn start upload
```

## Commands

| Command | Description |
|---|---|
| `yarn start auth` | Run OAuth 2.0 flow — opens browser, selects channel |
| `yarn start upload` | Start or resume the upload process |
| `yarn start upload --dry-run` | Preview what would be uploaded without making changes |
| `yarn start upload --item <id>` | Upload a single item by manifest ID |
| `yarn start status` | Show current quota usage and upload progress |
| `yarn start report` | Generate a JSON report of all uploads |

## How It Works

1. **Auth** — OAuth 2.0 credentials are retrieved from 1Password. On first run, you authorize via browser and select the target YouTube channel (brand account supported). Tokens are saved locally in `tokens.json`.

2. **Manifest Loading** — Three JSON files are read from the Google Shared Drive:
   - `manifest.json` — video inventory with file references and dates
   - `library.json` — speaker, scripture, and summary metadata
   - `series.json` — sermon series for playlist grouping

3. **Playlist Creation** — A YouTube playlist is created for each series in `series.json`.

4. **Upload Loop** — Videos are uploaded oldest-first. For each item:
   - Stream video from Drive to YouTube (no local temp files)
   - Set thumbnail (priority: `image_wide` > `image_banner` > `thumbnail_01`)
   - Add to the appropriate series playlist with position ordering
   - Videos are uploaded as **private** with category "Nonprofits & Activism"

5. **Quota Management** — YouTube API quota (10,000 units/day) is tracked automatically. Each video costs ~1,700 units (upload + thumbnail + playlist add), allowing ~5-6 videos per day. When quota is exhausted, the process sleeps until midnight Pacific and resumes.

6. **State Persistence** — Progress is saved to `upload-state.json` after each operation. If interrupted, `yarn start upload` picks up where it left off.

## Project Structure

```
src/
├── index.js        CLI entry point (commander)
├── auth.js         OAuth 2.0 flow with 1Password + brand account support
├── drive.js        Google Drive API — file lookup, streaming, JSON loading
├── manifest.js     Load and merge manifest/library/series from Drive
├── metadata.js     Build YouTube title, description, tags from manifest data
├── youtube.js      YouTube API wrapper with retry logic
├── playlists.js    Playlist creation and video insertion
├── upload.js       Upload orchestration loop with quota-aware sleeping
├── state.js        JSON state persistence for resumable uploads
├── quota.js        Quota tracking, reset at midnight Pacific
└── report.js       Generate upload report from state
utils/
├── logger.js       Pino logger (pretty in dev, JSON in prod)
└── package.js      Package.json metadata helper
```

## Configuration

### Environment Variables

Copy [.env.example](.env.example) to `.env` and configure:

```bash
NODE_ENV=development
DEBUG=false
OP_SERVICE_ACCOUNT_TOKEN=your_token_here
```

Optionally override the default 1Password secret references:

```bash
OP_GOOGLE_CLIENT_ID=op://YourVault/YourItem/client_id
OP_GOOGLE_CLIENT_SECRET=op://YourVault/YourItem/client_secret
```

### Linting

[XO](https://github.com/xojs/xo) is configured in [package.json](package.json) — 2-space indent, no semicolons.

```bash
yarn lint          # Check
yarn lint:fix      # Auto-fix
```

### Testing

```bash
yarn test            # Run tests
yarn test:watch      # Watch mode
yarn test:coverage   # With coverage
```

## Generated Files (gitignored)

| File | Purpose |
|---|---|
| `tokens.json` | OAuth refresh/access tokens |
| `upload-state.json` | Upload progress and quota tracking |
| `upload-report.json` | Summary report after completion |

## Author

Tim Chambers
Email: tim@auxilio.partners
Website: https://auxilio.partners
