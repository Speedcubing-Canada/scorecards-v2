import { Buffer } from 'buffer';
import PNG from 'png-js';
import { unzlibSync } from 'fflate';

// All of the polyfills below must be set before @react-pdf/renderer initializes.
// This module is imported first in scorecardWorker.ts so its side effects run
// before any react-pdf module code executes.
const g = globalThis as Record<string, unknown>;

// react-pdf / pdfkit / fontkit use Buffer (Node.js API, absent in browsers/workers)
g.Buffer = Buffer;

// react-pdf's browser build references `window` directly — workers have `self` instead
if (typeof window === 'undefined') g.window = globalThis;

// png-js and other react-pdf deps call document DOM APIs at module init time.
// Workers have no `document`, but do have OffscreenCanvas for the canvas case.
if (typeof document === 'undefined') {
  const noop = () => null;
  g.document = {
    createElement:    (tag: string) => tag === 'canvas' ? new OffscreenCanvas(1, 1) : {},
    createElementNS:  noop,
    querySelector:    noop,
    querySelectorAll: () => [],
    getElementById:   noop,
    getElementsByTagName: () => [],
    head: { appendChild: noop, removeChild: noop },
    body: { appendChild: noop, removeChild: noop },
  };
}

// fflate.unzlib (used by png-js.decodePixels) spawns a nested Worker for async
// decompression. Nested Workers don't reliably deliver messages back to our outer
// Worker, so pdfkit._waiting never reaches 0 and the PDF stream never emits 'end'.
// Fix: replace decodePixels with a sync implementation using unzlibSync.
// This patch runs before @react-pdf/renderer imports png-js, so the prototype
// is already patched when pdfkit calls png.decodePixels(callback).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(PNG as any).prototype.decodePixels = function (fn: (pixels: Uint8Array) => void) {
  const data = unzlibSync(new Uint8Array(this.imgData));
  const { width, height } = this as { width: number; height: number; pixelBitlength: number; interlaceMethod: number };
  const pixelBytes = this.pixelBitlength / 8;
  const pixels = new Uint8Array(width * height * pixelBytes);
  const len = data.length;
  let pos = 0;

  function pass(x0: number, y0: number, dx: number, dy: number, singlePass = false) {
    const w = Math.ceil((width - x0) / dx);
    const h = Math.ceil((height - y0) / dy);
    const scanlineLength = pixelBytes * w;
    const buffer = singlePass ? pixels : new Uint8Array(scanlineLength * h);
    let row = 0;
    let c = 0;
    while (row < h && pos < len) {
      // eslint-disable-next-line no-var
      var byte: number, col: number, i: number, left: number, upper: number;
      switch (data[pos++]) {
        case 0:
          for (i = 0; i < scanlineLength; i++) buffer[c++] = data[pos++];
          break;
        case 1:
          for (i = 0; i < scanlineLength; i++) {
            byte = data[pos++];
            left = i < pixelBytes ? 0 : buffer[c - pixelBytes];
            buffer[c++] = (byte + left) % 256;
          }
          break;
        case 2:
          for (i = 0; i < scanlineLength; i++) {
            byte = data[pos++];
            col = Math.floor(i / pixelBytes);
            upper = row ? buffer[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)] : 0;
            buffer[c++] = (upper + byte) % 256;
          }
          break;
        case 3:
          for (i = 0; i < scanlineLength; i++) {
            byte = data[pos++];
            col = Math.floor(i / pixelBytes);
            left = i < pixelBytes ? 0 : buffer[c - pixelBytes];
            upper = row ? buffer[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)] : 0;
            buffer[c++] = (byte + Math.floor((left + upper) / 2)) % 256;
          }
          break;
        case 4:
          for (i = 0; i < scanlineLength; i++) {
            // eslint-disable-next-line no-var
            var paeth: number, upperLeft: number;
            byte = data[pos++];
            col = Math.floor(i / pixelBytes);
            left = i < pixelBytes ? 0 : buffer[c - pixelBytes];
            upper = row ? buffer[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)] : 0;
            upperLeft = row && col ? buffer[(row - 1) * scanlineLength + (col - 1) * pixelBytes + (i % pixelBytes)] : 0;
            const p = left + upper - upperLeft;
            const pa = Math.abs(p - left);
            const pb = Math.abs(p - upper);
            const pc = Math.abs(p - upperLeft);
            paeth = pa <= pb && pa <= pc ? left : pb <= pc ? upper : upperLeft;
            buffer[c++] = (byte + paeth) % 256;
          }
          break;
        default:
          throw new Error(`Invalid filter algorithm: ${data[pos - 1]}`);
      }
      if (!singlePass) {
        let pixelsPos = ((y0 + row * dy) * width + x0) * pixelBytes;
        let bufferPos = row * scanlineLength;
        for (i = 0; i < w; i++) {
          for (let j = 0; j < pixelBytes; j++) pixels[pixelsPos++] = buffer[bufferPos++];
          pixelsPos += (dx - 1) * pixelBytes;
        }
      }
      row++;
    }
  }

  if (this.interlaceMethod === 1) {
    pass(0, 0, 8, 8); pass(4, 0, 8, 8); pass(0, 4, 4, 8);
    pass(2, 0, 4, 4); pass(0, 2, 2, 4); pass(1, 0, 2, 2); pass(0, 1, 1, 2);
  } else {
    pass(0, 0, 1, 1, true);
  }

  fn(pixels);
};
