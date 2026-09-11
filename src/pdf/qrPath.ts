import QRCode from 'qrcode';

// A name tag draws its QR as one Path, not one Rect per dark run. A code is ~200 runs and a
// tag carries two per panel, so at competition scale those Rects were the bulk of the whole
// document - and @react-pdf's layout cost scales with node count. Runs never overlap, so a
// single filled path draws exactly the same pixels.
//
// Its own module: NametTagDocument.tsx exports components, and mixing a plain function in
// there breaks fast refresh.

// Under 'both-sides' the front and back panels ask for the same two codes, and a code is a
// pure function of its URL.
const QR_CACHE = new Map<string, ReturnType<typeof QRCode.create>>();

function createQr(url: string) {
  let qr = QR_CACHE.get(url);
  if (!qr) {
    qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    QR_CACHE.set(url, qr);
  }
  return qr;
}

/** The `d` of a path covering every dark module, and the code's module count (its viewBox). */
export function qrPathData(url: string): { d: string; modules: number } {
  const qr   = createQr(url);
  const n    = qr.modules.size;
  const data = qr.modules.data as unknown as Uint8Array;

  let d = '';
  for (let row = 0; row < n; row++) {
    let start = -1;
    for (let col = 0; col <= n; col++) {
      const dark = col < n && data[row * n + col] !== 0;
      if (dark && start === -1) start = col;
      else if (!dark && start !== -1) {
        d += `M${start} ${row}h${col - start}v1h${start - col}z`;
        start = -1;
      }
    }
  }
  return { d, modules: n };
}
