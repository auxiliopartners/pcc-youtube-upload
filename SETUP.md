# Google Cloud Console Setup

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** > **New Project**
3. Name it (e.g., "PCC YouTube Upload") and click **Create**

## 2. Enable APIs

In your project, go to **APIs & Services > Library** and enable:

- **YouTube Data API v3**
- **Google Drive API**

## 3. Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** user type (required for brand account access)
3. Fill in required fields:
   - App name: "PCC YouTube Upload"
   - User support email: your email
   - Developer contact email: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/drive.readonly`
5. Add your Google account as a test user

## 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Desktop app**
4. Name: "PCC YouTube Upload CLI"
5. Click **Create**
6. Note the **Client ID** and **Client Secret**

## 5. Store Credentials in 1Password

Create an item in your 1Password vault:

- **Vault**: Private
- **Item name**: Google OAuth YouTube
- **Fields**:
  - `client_id`: your OAuth client ID
  - `client_secret`: your OAuth client secret

The default secret references used by the app are:
- `op://Private/Google OAuth YouTube/client_id`
- `op://Private/Google OAuth YouTube/client_secret`

You can override these with the environment variables `OP_GOOGLE_CLIENT_ID` and `OP_GOOGLE_CLIENT_SECRET`.

## 6. Configure Environment

Set `OP_SERVICE_ACCOUNT_TOKEN` in your `.env` file:

```
OP_SERVICE_ACCOUNT_TOKEN=your_1password_service_account_token
```

## 7. Authenticate

```bash
yarn start auth
```

This will:
1. Open a browser for Google OAuth authorization
2. Let you select the brand account/channel to upload to
3. Save tokens to `tokens.json` (gitignored)

## Quota Notes

- Default YouTube Data API quota: **10,000 units/day**
- Each video upload costs **1,600 units**
- Each thumbnail set costs **50 units**
- Each playlist item add costs **50 units**
- Effective capacity: **~6 videos/day** with thumbnails and playlist adds
- Quota resets at **midnight Pacific Time**

To request a quota increase, go to **APIs & Services > YouTube Data API v3 > Quotas** and click **Edit Quotas**.
