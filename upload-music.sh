#!/bin/bash
set -e

MUSIC_DIR="/mnt/c/Users/Usuario/Desktop/SOCIALCORS/MUSICA"
BUCKET="socialflow-media"
OUTPUT_SQL="seed-reel-music.sql"

> "$OUTPUT_SQL"

NICHES=("fitness" "motivation" "lifestyle" "education" "marketing")

for niche in "${NICHES[@]}"; do
  folder="$MUSIC_DIR/$niche"
  if [ ! -d "$folder" ]; then
    echo "AVISO: no encuentro la carpeta $folder, la salto"
    continue
  fi

  echo "Procesando nicho: $niche"

  for file in "$folder"/*.mp3; do
    [ -e "$file" ] || continue

    filename=$(basename "$file")
    name=$(basename "$file" .mp3 | sed 's/-/ /g')
    r2_key="music/${niche}/${filename}"
    id=$(cat /proc/sys/kernel/random/uuid)

    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file" | cut -d. -f1)

    echo "  -> $filename (${duration}s)"

    npx wrangler r2 object put "$BUCKET/$r2_key" --file="$file" --remote

    safe_name=$(echo "$name" | sed "s/'/''/g")

    echo "INSERT OR IGNORE INTO reel_music_tracks (id, name, r2_key, niche, mood, duration_seconds, source, active) VALUES ('$id', '$safe_name', '$r2_key', '$niche', NULL, $duration, 'pixabay', 1);" >> "$OUTPUT_SQL"
  done
done

echo ""
echo "Listo. Generado $OUTPUT_SQL con $(wc -l < "$OUTPUT_SQL") tracks."
