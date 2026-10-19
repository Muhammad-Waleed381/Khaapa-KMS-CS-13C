#!/usr/bin/env bash
# Prepares the hero film from one source clip: muted, web-optimised loops plus a
# poster frame, written to public/hero. Then set HERO_VIDEO in
# src/components/public/hero-video.tsx to the printed paths.
#
#   scripts/hero-video.sh path/to/clip.mov
set -euo pipefail

src="${1:?usage: scripts/hero-video.sh <clip>}"
out="$(cd "$(dirname "$0")/.." && pwd)/public/hero"
mkdir -p "$out"

# No audio (the film plays muted), even pixel dimensions, 30 fps at most.
common=(-an -map_metadata -1 -r 30)

# Bitrates are capped: the film sits under a dark tint, so ~2 MB for 8 s is plenty.
# Desktop: 1920 wide. WebM/VP9 for browsers that take it, H.264 for the rest.
ffmpeg -y -loglevel error -i "$src" "${common[@]}" -vf "scale='min(1920,iw)':-2" \
  -c:v libvpx-vp9 -b:v 1800k -crf 38 -row-mt 1 -deadline good -cpu-used 2 "$out/hero.webm"
ffmpeg -y -loglevel error -i "$src" "${common[@]}" -vf "scale='min(1920,iw)':-2" \
  -c:v libx264 -preset slow -crf 26 -maxrate 2M -bufsize 4M -pix_fmt yuv420p -profile:v high -movflags +faststart "$out/hero.mp4"

# Phones: 720 wide, so a small screen doesn't pull the full-size file.
ffmpeg -y -loglevel error -i "$src" "${common[@]}" -vf "scale='min(720,iw)':-2" \
  -c:v libx264 -preset slow -crf 27 -maxrate 900k -bufsize 1800k -pix_fmt yuv420p -profile:v high -movflags +faststart "$out/hero-720.mp4"

# Poster: the first frame, so the still and the start of the loop match.
ffmpeg -y -loglevel error -i "$src" -frames:v 1 -vf "scale='min(1920,iw)':-2" -q:v 4 "$out/poster.jpg"

du -h "$out"/* | sed "s|$out/||"
cat <<EOF

Set in src/components/public/hero-video.tsx:
  export const HERO_VIDEO = { mp4: "/hero/hero.mp4", mp4Small: "/hero/hero-720.mp4", webm: "/hero/hero.webm", poster: "/hero/poster.jpg" };
EOF
