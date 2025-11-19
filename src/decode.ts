/**
 * Options for decoding Windows-1252
 */
export interface DecodeOptions {
  /**
   * How to handle bytes that cannot be decoded:
   * - 'replacement': Replace with � (U+FFFD) - WHATWG default
   * - 'fatal': Throw an error
   */
  mode?: 'replacement' | 'fatal';
}

// Mapping for Windows-1252 specific characters (0x80-0x9F range)
// Note: 0x81, 0x8D, 0x8F, 0x90, 0x9D are undefined in Windows-1252
// and should be replaced with U+FFFD per WHATWG standard
const WINDOWS_1252_MAP: { [key: number]: number } = {
  0x80: 0x20ac, // €
  // 0x81: 0x0081, // <control>
  0x82: 0x201a, // ‚
  0x83: 0x0192, // ƒ
  0x84: 0x201e, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02c6, // ˆ
  0x89: 0x2030, // ‰
  0x8a: 0x0160, // Š
  0x8b: 0x2039, // ‹
  0x8c: 0x0152, // Œ
  // 0x8D: 0x008D, // <control>
  0x8e: 0x017d, // Ž
  // 0x8F: 0x008F, // <control>
  // 0x90: 0x0090, // <control>
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201c, // "
  0x94: 0x201d, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x02dc, // ˜
  0x99: 0x2122, // ™
  0x9a: 0x0161, // š
  0x9b: 0x203a, // ›
  0x9c: 0x0153, // œ
  // 0x9D: 0x009D, // <control>
  0x9e: 0x017e, // ž
  0x9f: 0x0178, // Ÿ
};

/**
 * Decodes a Windows-1252 encoded byte array to a UTF-16 string
 * @param bytes - Array of bytes in Windows-1252 encoding
 * @param options - Decoding options
 * @returns Decoded string
 */
export function decode(
  bytes: Uint8Array | number[],
  options: DecodeOptions = {},
): string {
  const { mode = 'replacement' } = options;
  const length = bytes.length;
  const chars: number[] = new Array(length);
  let charIndex = 0;

  for (let i = 0; i < length; i++) {
    const byte = bytes[i]!;

    // Validate byte range
    if (byte < 0 || byte > 0xff) {
      if (mode === 'fatal') {
        throw new Error(`Invalid byte value: ${byte} (must be 0-255)`);
      }
      chars[charIndex++] = 0xfffd; // Replacement character �
      continue;
    }

    if (byte < 0x80) {
      // ASCII range (0x00-0x7F) - direct mapping
      chars[charIndex++] = byte;
    } else if (byte <= 0x9f) {
      // Windows-1252 specific mappings (0x80-0x9F)
      const codePoint = WINDOWS_1252_MAP[byte];
      if (codePoint !== undefined) {
        chars[charIndex++] = codePoint;
      } else {
        if (mode === 'fatal') {
          throw new Error(
            `Invalid Windows-1252 byte: 0x${byte.toString(16).toUpperCase()}`,
          );
        }
        chars[charIndex++] = 0xfffd; // Replacement character �
      }
    } else {
      // ISO-8859-1 range (0xA0-0xFF) - direct mapping
      chars[charIndex++] = byte;
    }
  }

  return String.fromCodePoint(...chars.slice(0, charIndex));
}
