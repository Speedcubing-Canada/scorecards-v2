import QRCode from 'qrcode';

// One Path instead of ~200 Rects per code: @react-pdf's layout cost scales with node count.
// Its own module because NametTagDocument.tsx exports components, and a plain function in
// there breaks fast refresh.

// Both panels ask for the same two codes.
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
