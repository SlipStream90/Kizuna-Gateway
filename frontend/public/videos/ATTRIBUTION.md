# Background footage attribution

The ambient background videos in this app are freely licensed works hosted
locally under `frontend/public/videos/`. This file records provenance so the
project stays compliant without hotlinking third-party CDNs. The MP4 files are
H.264 transcodes (1080p, CRF 26) produced with FFmpeg from the original
downloads; the `.webm` originals are kept as playback fallbacks and posters
were extracted locally.

## 1. Togetsukyo — Kyoto in spring (`cherry-blossom.*`)

- Source: https://commons.wikimedia.org/wiki/File:Togetsukyo_-_kyoto_-_March_16_2020.webm
- Author: Nesnad
- License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- Notes: ambient spring footage for the hero background rotation.

## 2. Diamond Fuji, Mihama-Ohashi Bridge (`mt-fuji.*`)

- Source: https://commons.wikimedia.org/wiki/File:Video-Diamond-Fuji_Mihama-Ohashi-Bridge_2021-02-21_02.webm
- Author: RuinDig / Yuki Uchida
- License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- Notes: compact 1 MB 1080p loop of Mount Fuji at sunrise.

## 3. Tokyo street scene (`japanese-street.*`)

- Source: https://commons.wikimedia.org/wiki/File:Uchiwadaiko-tokyo-street-2014-2-16.webm
- Author: Nesnad
- License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
- Notes: share-alike footage; no derivative beyond format transcode and resize.

## 4. Rain chain at a Japanese temple (`temple-rain-chain.*`)

- Source: https://commons.wikimedia.org/wiki/File:Rain_chain_at_japanese_temple_-_july_4_2021.webm
- Author: Nesnad
- License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- Notes: 4K original transcoded to 1080p MP4 for the rotation.

## License duties

- Keep this file with the videos; credit travels with the files.
- The CC BY 4.0 clips require attribution (this file plus the source links).
- The CC BY-SA 4.0 clip (`japanese-street`) additionally requires derivatives
  to stay under CC BY-SA 4.0; plain transcoding/resizing is fine.
- All four originals were verified via the Wikimedia Commons API
  (`prop=videoinfo` + `extmetadata.LicenseShortName`) before download.
