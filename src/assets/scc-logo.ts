// Speedcubing Canada logo, embedded as a base64 data URL.
// ?inline is required so react-pdf's PNG path receives a data URI (the worker
// has no fs.readFile, so /path URLs fail). Same pattern as events.ts.
import sccLogo from './SC_Logo.png?inline';

export const SCC_DEFAULT_LOGO: string = sccLogo;
