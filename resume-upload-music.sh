#!/bin/bash

MUSIC_DIR="/mnt/c/Users/Usuario/Desktop/SOCIALCORS/MUSICA"
BUCKET="socialflow-media"
OUTPUT_SQL="seed-reel-music.sql"

NICHES=("fitness" "motivation" "lifestyle" "education" "marketing")

for niche in "${NICHES[@]}"; do
  folder="$MUSIC_DIR/$niche"
  if [ ! -d "$folder" ]; then
    continue
  fi

  for file in "$folder"/*.mp3; do
    [ -e "$file" ] || continue

    filename=$(basename "$file")
    r2_key="music/${niche}/${filename}"

    # Si ya está en el SQL generado, lo saltamos (ya se subió antes)
    if grep -qF "'$r2_key'" "$OUTPUT_SQL" 2>/dev/null; then
      echo "  (ya hecho, salto) $filename"
      continue
    fi

    name=$(basename "$file" .mp3 | sed 's/-/ /g')
    id=$(cat /proc/sys/kernel/random/uuid)
    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file" | cut -d. -f1)

    echo "  -> subiendo $filename (${duration}s)"

    if npx wrangler r2 object put "$BUCKET/$r2_key" --file="$file" --remote; then
      safe_name=$(echo "$name" | sed "s/'/''/g")
      echo "INSERT OR IGNORE INTO reel_music_tracks (id, name, r2_key, niche, mood, duration_seconds, source, active) VALUES ('$id', '$safe_name', '$r2_key', '$niche', NULL, $duration, 'pixabay', 1);" >> "$OUTPUT_SQL"
    else
      echo "  !! FALLÓ: $filename — reintenta luego"
    fi
  done
done

echo ""
echo "Listo. Total en $OUTPUT_SQL: $(wc -l < "$OUTPUT_SQL") tracks."
