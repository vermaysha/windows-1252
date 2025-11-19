/**
 * Options for encoding to Windows-1252
 */
export interface EncodeOptions {
  /**
   * How to handle characters that cannot be encoded:
   * - 'fatal': Throw an error (default, per WHATWG spec)
   * - 'replacement': Replace with '?' (0x3F)
   */
  mode?: 'fatal' | 'replacement';
}

// Reverse mapping for encoding (Unicode code point -> Windows-1252 byte)
const UNICODE_TO_WINDOWS_1252: { [key: number]: number } = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

/**
 * Encodes a UTF-16 string to Windows-1252 byte array
 * @param str - String to encode
 * @param options - Encoding options
 * @returns Uint8Array of bytes in Windows-1252 encoding
 * @throws Error if string contains characters not representable in Windows-1252 and mode is 'fatal'
 */
export function encode(str: string, options: EncodeOptions = {}): Uint8Array {
  const { mode = 'fatal' } = options;
  const length = str.length;
  const bytes = new Uint8Array(length);
  let byteIndex = 0;

  for (let i = 0; i < length; i++) {
    const codePoint = str.codePointAt(i)!;

    if (codePoint < 0x80) {
      // ASCII range - direct mapping
      bytes[byteIndex++] = codePoint;
    } else if (codePoint >= 0xa0 && codePoint <= 0xff) {
      // ISO-8859-1 range - direct mapping
      bytes[byteIndex++] = codePoint;
    } else {
      // Check Windows-1252 specific characters
      const win1252Byte = UNICODE_TO_WINDOWS_1252[codePoint];
      if (win1252Byte !== undefined) {
        bytes[byteIndex++] = win1252Byte;
      } else {
        // Character cannot be encoded in Windows-1252
        if (mode === 'fatal') {
          throw new Error(
            `Character '${String.fromCodePoint(codePoint)}' (U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}) ` +
              `cannot be encoded in Windows-1252`,
          );
        }

        // Replacement mode: use '?' (0x3F)
        bytes[byteIndex++] = 0x3f;
      }
    }

    // Skip low surrogate if present
    if (codePoint > 0xffff) {
      i++;
    }
  }

  // Return sliced array with actual size
  return bytes.subarray(0, byteIndex);
}
