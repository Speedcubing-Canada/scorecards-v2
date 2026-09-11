import { Font } from '@react-pdf/renderer';

// Turns off @react-pdf hyphenation, which breaks competitor names mid-word with a dash that
// reads as part of the name in print. Documents control line breaks through their own
// computed font sizes instead. Import for the side effect: `import './fontSetup'`.
//
// Not in layoutConstants.ts: the page-count estimator imports that on the main thread, which
// must stay free of @react-pdf.
Font.registerHyphenationCallback((word) => [word]);
