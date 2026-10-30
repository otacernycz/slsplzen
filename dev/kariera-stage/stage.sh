#!/usr/bin/env bash
# Lokální stage náborového webu: web s funkčním formulářem + falešná tabulka.
#   web:      http://127.0.0.1:8096/
#   tabulka:  http://127.0.0.1:8097/
# Spuštění z kořene repa: dev/kariera-stage/stage.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/dev/kariera-stage"
CONFIG="$ROOT/kariera-web/kariera-config.php"

# lead.php čte kariera-config.php vedle sebe. Na stage ho založíme s adresou
# falešné tabulky; existující (třeba skutečný) config nepřepisujeme.
if [[ ! -f "$CONFIG" ]]; then
  cat > "$CONFIG" <<'PHP'
<?php
// STAGE – vygenerováno dev/kariera-stage/stage.sh. Na server nenahrávat.
define('KARIERA_SHEET_WEBHOOK', 'http://127.0.0.1:8097/');
define('KARIERA_SHEET_TOKEN', 'stage-token');
define('ECOMAIL_API_KEY', '');
define('ECOMAIL_LIST_ID', '');
PHP
  echo "Založen stage config: kariera-web/kariera-config.php"
elif ! grep -q 'STAGE' "$CONFIG"; then
  echo "Pozor: kariera-web/kariera-config.php není stage config – leady půjdou podle něj." >&2
fi

php -S 127.0.0.1:8097 "$HERE/mock-sheet.php" &
MOCK=$!
trap 'kill $MOCK 2>/dev/null' EXIT
php -S 127.0.0.1:8096 -t "$ROOT/kariera-web"
