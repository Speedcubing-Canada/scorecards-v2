#!/usr/bin/env bash
# Re-render every fixture PDF and diff it against a saved baseline.
#
#   scripts/checkFixtures.sh <baseline-dir> [outdir] [dpi]
#
# Use after any change that could touch PDF output. The layout unit tests assert
# measurements; this catches everything they cannot see - a changed colour, a shifted
# margin, a dropped glyph. Exits non-zero if any page differs.
#
# Populate the baseline first, from a known-good commit:
#   npm run render:fixtures && npm run render:fixtures -- --horizontal
#   (copying the four PDFs named below into <baseline-dir>)
set -euo pipefail

BASELINE="${1:?need baseline dir}"
OUTDIR="${2:-/tmp/fixture-check}"
DPI="${3:-150}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$(dirname "$HERE")"
OUT="$APP/../current-output"
DIFF="$(cd "$APP/.." && pwd)/.claude/skills/pdf-print-edit/scripts/pdf_diff.sh"

rm -rf "$OUTDIR"; mkdir -p "$OUTDIR"
fail=0

check() { # <label> <rendered.pdf> <baseline.pdf>
  local label="$1" got="$2" want="$3"
  if [ ! -f "$want" ]; then
    echo "SKIP $label (no baseline at $want)"; return
  fi
  bash "$DIFF" "$want" "$got" "$OUTDIR/$label" "$DPI" >"$OUTDIR/$label.log" 2>&1 || true
  local max
  max=$(awk '/^max page MAE:/ {print $4}' "$OUTDIR/$label.log")
  # Guard against an empty/failed run reading as a pass.
  if [ -z "$max" ]; then
    echo "FAIL $label - diff produced no metric (see $OUTDIR/$label.log)"; fail=1; return
  fi
  if awk -v m="$max" 'BEGIN{exit !(m+0==0)}'; then
    echo "OK   $label (pixel-identical)"
  else
    echo "FAIL $label - max page MAE $max (see $OUTDIR/$label/)"
    fail=1
  fi
}

cd "$APP"
npm run --silent render:fixtures >/dev/null
check nametags_vertical "$OUT/GrosJouetsaMontreal2026_nametags.pdf" "$BASELINE/nametags_vertical.pdf"
check first_timers     "$OUT/GrosJouetsaMontreal2026_first_timers.pdf" "$BASELINE/first_timers.pdf"
check scorecards       "$OUT/scorecard-layout-test.pdf"              "$BASELINE/scorecards.pdf"

npm run --silent render:fixtures -- --horizontal >/dev/null
check nametags_horizontal "$OUT/GrosJouetsaMontreal2026_nametags.pdf" "$BASELINE/nametags_horizontal.pdf"

# Leave current-output/ holding the default (vertical) render.
npm run --silent render:fixtures >/dev/null

if [ "$fail" -ne 0 ]; then
  echo "PDF OUTPUT CHANGED - inspect the diffs above before continuing."
  exit 1
fi
echo "All fixtures pixel-identical to baseline."
