'use strict';

/**
 * Linear-time replacement for decode-uri-component 0.2.2, the decoder that Expo Router's
 * query-string 7 uses (GHSA-qr28-fpjm-wq7f, KI-12). The original's fallback for malformed input
 * is quadratic: a 3,000-character `%C2%C2…` string blocks the JavaScript thread for ~10 s.
 * metro.config.js and the Jest config resolve `decode-uri-component` to this file, so the
 * vulnerable code is not in the app bundle. Remove this shim with the Expo SDK 58 upgrade.
 *
 * Same contract as the original: `+` becomes a space, valid input is decoded by the built-in
 * decoder (identical result), and malformed input never throws. For malformed input each complete
 * UTF-8 sequence is decoded and every other escape is kept as written (the original's result for
 * malformed input differs in some edge cases; no app route depends on malformed input).
 */

// Runs of percent escapes. No nested quantifiers, so matching is linear.
const ESCAPE_RUN = /(?:%[0-9a-fA-F]{2})+/g;

/** Number of bytes in the UTF-8 sequence a lead byte starts, or 0 if it cannot start one. */
function sequenceLength(byte) {
  if (byte < 0x80) return 1;
  if (byte >= 0xc2 && byte <= 0xdf) return 2;
  if (byte >= 0xe0 && byte <= 0xef) return 3;
  if (byte >= 0xf0 && byte <= 0xf4) return 4;
  return 0;
}

function decodeRun(run) {
  const count = run.length / 3;
  let out = '';
  let i = 0;
  while (i < count) {
    const length = sequenceLength(parseInt(run.slice(i * 3 + 1, i * 3 + 3), 16));
    if (length > 0 && i + length <= count) {
      try {
        out += decodeURIComponent(run.slice(i * 3, (i + length) * 3));
        i += length;
        continue;
      } catch {
        // Not a valid sequence (overlong, surrogate or bad continuation byte): keep the escape.
      }
    }
    out += run.slice(i * 3, i * 3 + 3);
    i += 1;
  }
  return out;
}

module.exports = function decodeUriComponent(encodedURI) {
  if (typeof encodedURI !== 'string') {
    throw new TypeError(
      'Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`',
    );
  }
  const input = encodedURI.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(input);
  } catch {
    return input.replace(ESCAPE_RUN, decodeRun);
  }
};
