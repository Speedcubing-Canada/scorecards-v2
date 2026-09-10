#!/usr/bin/env bash
# pdfDiff.sh - Render two PDFs to images and measure their per-page difference.
#
# Vendored from the pdf-print-edit skill so it lives inside the repo and CI can run it;
# the skill directory sits above the git root and is not part of a checkout.
#
# This is the heart of verifying a print-PDF edit: it turns "did my change do what
# I wanted, and nothing else?" into concrete numbers + images you can actually look at.
#
# Usage:
#   pdf_diff.sh <before.pdf> <after.pdf> [outdir] [dpi]
#
#   before.pdf   the PDF as it was BEFORE your edit (or the reference original)
#   after.pdf    the PDF as it is AFTER your edit
#   outdir       where images go (default: ./pdf-diff-out). Cleared on each run.
#   dpi          render resolution (default: 150). Use 200+ when checking hairline
#                margins/cut lines; higher dpi surfaces sub-pixel shifts.
#
# Output:
#   <outdir>/before-NNN.png   each page of the before PDF
#   <outdir>/after-NNN.png    each page of the after PDF
#   <outdir>/diff-NNN.png     red-highlighted pixels that changed (only where dims match)
#   <outdir>/summary.txt      per-page MAE metric + verdict
#
# MAE (mean absolute error, 0..1) is the fraction of difference across all pixels.
#   0.0000            => pixel-identical pages
#   tiny (<0.001)     => anti-aliasing noise, effectively unchanged
#   localized + small => an intended local edit (confirm in diff-NNN.png it's WHERE you meant)
#   large/everywhere  => a global shift (often a margin/offset regression on a print layout)
#
# Tool note: in this environment `convert`/`gm` is GraphicsMagick (not ImageMagick),
# so we use `gm compare`. pdftoppm names pages with zero-padded 3-digit suffixes.
set -euo pipefail

BEFORE="${1:?need before.pdf}"
AFTER="${2:?need after.pdf}"
OUTDIR="${3:-./pdf-diff-out}"
DPI="${4:-150}"

for f in "$BEFORE" "$AFTER"; do
  [ -f "$f" ] || { echo "ERROR: file not found: $f" >&2; exit 1; }
done

rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"

echo "Rendering at ${DPI} dpi…"
pdftoppm -png -r "$DPI" "$BEFORE" "$OUTDIR/before" >/dev/null 2>&1
pdftoppm -png -r "$DPI" "$AFTER"  "$OUTDIR/after"  >/dev/null 2>&1

shopt -s nullglob
before_pages=("$OUTDIR"/before-*.png)
after_pages=("$OUTDIR"/after-*.png)
nb=${#before_pages[@]}
na=${#after_pages[@]}

SUMMARY="$OUTDIR/summary.txt"
{
  echo "PDF diff summary"
  echo "  before: $BEFORE  ($nb pages)"
  echo "  after : $AFTER  ($na pages)"
  echo "  dpi   : $DPI"
  echo
} | tee "$SUMMARY"

if [ "$nb" -ne "$na" ]; then
  echo "⚠️  PAGE COUNT CHANGED: $nb → $na  (an edit that changes page count is a big deal for a print job)" | tee -a "$SUMMARY"
fi

# pdftoppm zero-pads to the width of the page count (e.g. 2 digits for <100 pages,
# 3 for >=100), so the before/after PDFs can use DIFFERENT padding. Don't reconstruct
# filenames: sort the actual files and pair them positionally.
IFS=$'\n' before_pages=($(printf '%s\n' "${before_pages[@]}" | sort))
IFS=$'\n' after_pages=($(printf '%s\n' "${after_pages[@]}" | sort))
unset IFS

pages=$nb; [ "$na" -lt "$pages" ] && pages=$na
maxmae=0
printf "%-6s %-12s %s\n" "page" "MAE" "note" | tee -a "$SUMMARY"
for i in $(seq 1 "$pages"); do
  p=$(printf "%03d" "$i")
  b="${before_pages[$((i-1))]}"
  a="${after_pages[$((i-1))]}"
  [ -f "$b" ] && [ -f "$a" ] || continue

  bdim=$(gm identify -format "%wx%h" "$b")
  adim=$(gm identify -format "%wx%h" "$a")
  if [ "$bdim" != "$adim" ]; then
    printf "%-6s %-12s %s\n" "$i" "DIM-MISMATCH" "$bdim -> $adim (page geometry changed, inspect before/after directly)" | tee -a "$SUMMARY"
    continue
  fi

  mae=$(gm compare -metric MAE "$b" "$a" 2>/dev/null | awk '/Total:/ {print $2}')
  [ -z "$mae" ] && mae="NA"
  gm compare -highlight-color red -file "$OUTDIR/diff-$p.png" "$b" "$a" >/dev/null 2>&1 || true

  note=""
  if [ "$mae" != "NA" ]; then
    if   awk -v m="$mae" 'BEGIN{exit !(m+0==0)}';            then note="identical"
    elif awk -v m="$mae" 'BEGIN{exit !(m+0<0.001)}';        then note="≈identical (AA noise)"
    else note="CHANGED → inspect diff-$p.png"; fi
    if awk -v m="$mae" "BEGIN{exit !(m+0>$maxmae+0)}"; then maxmae="$mae"; fi
  fi
  printf "%-6s %-12s %s\n" "$i" "$mae" "$note" | tee -a "$SUMMARY"
done

echo | tee -a "$SUMMARY"
echo "max page MAE: $maxmae" | tee -a "$SUMMARY"
echo "Images in: $OUTDIR  (before-*.png, after-*.png, diff-*.png)" | tee -a "$SUMMARY"
echo
echo "Next: Read the before/after/diff PNGs to confirm the change is (a) present where intended and (b) absent everywhere else."
