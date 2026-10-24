# Background video assets

`BackgroundVideo.tsx` rotates four locally hosted clips as an ambient hero
background. The media files are **not committed to this repository** because
they total ~33 MB and the initial push could not complete over a throttled
uplink. The app degrades gracefully when they are absent (the gradient
background still renders), but the intended look requires the files below.

Provenance and licences for every clip live in [`ATTRIBUTION.md`](./ATTRIBUTION.md).

## Expected files

| Path | Size (approx.) |
| --- | --- |
| `cherry-blossom.mp4` | 3.3 MB |
| `cherry-blossom.webm` | 2.8 MB |
| `japanese-street.mp4` | 3.8 MB |
| `japanese-street.webm` | 3.1 MB |
| `mt-fuji.mp4` | 3.2 MB |
| `mt-fuji.webm` | 1.0 MB |
| `temple-rain-chain.mp4` | 6.9 MB |
| `temple-rain-chain.webm` | 11.7 MB |
| `posters/cherry-blossom.jpg` | 140 KB |
| `posters/japanese-street.jpg` | 170 KB |
| `posters/mt-fuji.jpg` | 19 KB |
| `posters/temple-rain-chain.jpg` | 400 KB |

## How to restore them

1. Ask a teammate who has the working copy to share `frontend/public/videos/`
   (it is the fastest path — the exact transcodes are already done).
2. Or rebuild them from the Wikimedia Commons sources listed in
   `ATTRIBUTION.md`:

   ```bash
   ffmpeg -i source.webm -vf scale=1920:-2 -c:v libx264 -crf 26 -preset slow \
     -movflags +faststart -an cherry-blossom.mp4
   ffmpeg -i source.webm -ss 00:00:01 -frames:v 1 -q:v 3 posters/cherry-blossom.jpg
   ```

   Keep the original `.webm` alongside the MP4 transcode as the playback
   fallback.

## Then commit

Once the files are present and the connection can handle them, add them in
small batches (one clip per commit) so a slow or flaky uplink does not time
out mid-push:

```bash
git add frontend/public/videos/mt-fuji.mp4 frontend/public/videos/mt-fuji.webm
git commit -m "assets: add mt-fuji background video"
git push
```
