import { Font } from '@react-pdf/renderer';

// Turn off @react-pdf's hyphenation everywhere. Left on, it breaks competitor names and
// event labels mid-word with a dash, which on a printed scorecard reads as part of the
// name. Every document instead controls line breaks through its own computed font sizes.
//
// This is a global registration on the shared Font object, so it only needs to happen
// once - it lived in all five document modules, which worked only because they all
// registered the identical callback. Import this module for the side effect:
//
//   import './fontSetup';
//
// Kept out of layoutConstants.ts on purpose: that module is imported by the page-count
// estimator on the main thread and must stay free of @react-pdf imports, so the PDF
// engine (and its Buffer polyfill ordering) never reaches the main bundle.
Font.registerHyphenationCallback((word) => [word]);
