# [YouTube API Services - Audit and Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form?hl=en&authuser=1)

## General Information

### Your full legal name *
Timothy Chambers

### Your organization's name *
Pacific Crossroads Church

### Your organization's website *
https://pacificcrossroads.org

### Your organization's address *
1590 Rosecrans Avenue Suite D #419, Manhattan Beach, CA 90266

### Organization contact email address *
finance@pacificcrossroads.org

### Describe your organization's work as it relates to YouTube * [1000 characters]
Pacific Crossroads Church is a nonprofit in Los Angeles that uses YouTube to livestream weekly services and publish sermon recordings. We have an archive of 505 past sermon videos stored on a Google Shared Drive that we need to upload to our YouTube channel, organized into 72 series playlists.

### Google representative email address
N/A

### Content Owner ID (if available)
N/A

## API Client Information

### Have you undergone an audit since June 2019? *
No

### Is there any way in which your client's use of the YT API changed since the last audit? *
No

### Please list all your API Client(s) *

#### Name of your app or website (Please enter comma separated values if there are multiple API Clients)
PCC YouTube Upload CLI

### Please list all the project numbers used for each of your API Client(s) *
#### The project number is a series of digits that can be found alongside the Project ID in your Google Cloud Console. Please comma separate the project numbers without additional spaces.
150130945051

### If there is a log-in required to access the API client, please provide a demo account and instructions on how to access the API Client
N/A

### Choose the option that best resembles your API Client's use case *
YouTube video uploads

### Send documents (e.g., design documents, etc.) relating to your implementation, access, integration and use of YouTube API Services by each of your API Client/If the API Client is not accessible publicly, please upload a detailed screencast of each YouTube API Service functionality and YouTube data, content and information as displayed on, or integrated into, this API Client. *

## Quota Request Form

### Which API Client are you requesting a quota increase for? *
PCC YouTube Upload CLI

### What API project number are you requesting increased quota for? *
150130945051

### Which YouTube API Service(s) are you requesting a quota increase for? *
Data API

### How much "Additional Quota" are you requesting? *
90,000 units/day (requesting 100,000 total daily quota, currently at default 10,000)

#### "Additional Quota" = "Total Quota Needed" - "Current Allocated Quota"

### Justification for requesting additional quota? * [1000 characters]
We have a one-time bulk upload of 505 archived sermon videos from Google Shared Drive to YouTube, organized into 72 series playlists.

Per-video API cost:
- videos.insert: 1,600 units
- thumbnails.set: 50 units
- playlistItems.insert: 50 units
- Total per video: 1,700 units

505 videos x 1,700 = 858,500 units
72 playlists x 100 (create + thumbnail) = 7,200 units
Grand total: ~866,000 units for the entire project.

At 10,000 units/day: ~5 videos/day, ~100 days.
At 100,000 units/day: ~58 videos/day, complete in ~9 days.

Daily usage: Sequential uploads with 5-second delays. Peak QPS is 1 (single-threaded, no concurrent uploads). The tool tracks quota locally and automatically pauses at the daily limit, resuming after midnight Pacific.

This is a temporary need for a finite archive migration. Once complete, our ongoing API usage returns to near-zero.

### Explain in detail how you use YouTube API Services today * [1000 characters]
#### Provide a detailed breakdown of API calls currently being made by the API Client and what they are used for
Our CLI tool ("PCC YouTube Upload CLI") performs these API operations:

1. youtube.videos.insert (1,600 units) — Upload video file streamed from Google Shared Drive with metadata: title, description (speaker, scripture, summary), tags, category (Nonprofits & Activism), recording date. Videos uploaded as private.

2. youtube.thumbnails.set (50 units) — Set custom thumbnail from our Drive archive for each video.

3. youtube.playlists.list (1 unit) — Check for existing playlists to avoid duplicates.

4. youtube.playlists.insert (50 units) — Create a playlist for each sermon series (72 total).

5. youtube.playlistItems.insert (50 units) — Add each uploaded video to its series playlist.

6. youtube.playlistImages.insert (50 units) — Set playlist cover images from series artwork.

7. youtube.channels.list (1 unit) — Select brand account channel during auth.

The tool runs sequentially (one video at a time), saves state after each operation, tracks quota locally, and automatically pauses when daily quota is exhausted.

### What functionality would your API client be lacking without more quota? * [1000 characters]
Without additional quota, the bulk archive upload would take approximately 100 days to complete (~5 videos per day at the default 10,000 unit quota). This significantly delays making our church's 505-video sermon archive accessible to our congregation on YouTube.

Our tool handles quota exhaustion gracefully — it tracks usage, pauses when the daily limit is reached, and automatically resumes after midnight Pacific. However, at the current rate, this one-time migration would stretch from under two weeks to over three months, during which we must maintain the archive on Google Shared Drive and keep the process running daily.

All functionality works correctly at the current quota level. This is purely a throughput limitation for a temporary bulk operation.

### What potential workarounds would you use to compensate for less quota? (ex. decreased feature set, estimations, smaller sampling) * [1000 characters]
#### Ex: decreased feature set, estimated change in usage, etc.
Without a quota increase, our primary workaround would be to accept the slower pace of ~5 videos/day and run the tool continuously over ~100 days. Our tool supports this — it saves state after each upload, resumes from where it left off, and automatically pauses and resumes across daily quota resets.

We could prioritize a subset of the archive (e.g., most recent sermons first) and upload the remainder over time.

We could skip custom thumbnails (saving 50 units/video, ~25,000 total), but this results in a less polished presentation.

If a partial increase were granted (e.g., 50,000 units/day), we could complete the project in ~3 weeks instead of ~9 days, which would be acceptable.
