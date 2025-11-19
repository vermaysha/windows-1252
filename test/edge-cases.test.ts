import { describe, it, expect } from 'bun:test';
import { encode, decode } from '../src';

describe('edge cases', () => {
  describe('decode with various typed arrays', () => {
    it('should handle Int8Array with negative values in replacement mode', () => {
      const bytes = new Int8Array([0x48, -1, 0x65]); // -1 is out of valid byte range
      const decoded = decode(bytes as any, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFDe');
    });

    it('should throw in fatal mode for negative values from Int8Array', () => {
      const bytes = new Int8Array([0x48, -1, 0x65]);
      expect(() => decode(bytes as any, { mode: 'fatal' })).toThrow();
      expect(() => decode(bytes as any, { mode: 'fatal' })).toThrow(
        /Invalid byte value/,
      );
    });

    it('should handle Int16Array with values >255: fatal throws, replacement uses U+FFFD', () => {
      const bytes = new Int16Array([0x48, 300, 0x65]);
      expect(() => decode(bytes as any, { mode: 'fatal' })).toThrow();
      const decoded = decode(bytes as any, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFDe');
    });

    it('should handle Uint8ClampedArray (clamped values like 300 -> 255)', () => {
      const clamped = new Uint8ClampedArray([0x48, 300, 0x65]);
      // Uint8ClampedArray clamps 300 to 255 (0xFF -> 'ÿ')
      const decoded = decode(clamped as any);
      expect(decoded).toBe('Hÿe');
      expect(decoded.charCodeAt(1)).toBe(0xff);
    });

    it('should handle Int32Array with large values', () => {
      const bytes = new Int32Array([0x48, 65536, 0x65]);
      expect(() => decode(bytes as any, { mode: 'fatal' })).toThrow();
      const decoded = decode(bytes as any, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFDe');
    });
  });

  describe('decode with fatal mode for undefined Windows-1252 bytes', () => {
    it('should throw for 0x81 in fatal mode', () => {
      const bytes = new Uint8Array([0x81]);
      expect(() => decode(bytes, { mode: 'fatal' })).toThrow();
      expect(() => decode(bytes, { mode: 'fatal' })).toThrow(
        /Invalid Windows-1252 byte: 0x81/,
      );
    });

    it('should throw for all undefined bytes (0x81, 0x8D, 0x8F, 0x90, 0x9D) in fatal mode', () => {
      const undefinedBytes = [0x81, 0x8d, 0x8f, 0x90, 0x9d];
      undefinedBytes.forEach((byte) => {
        const bytes = new Uint8Array([byte]);
        expect(() => decode(bytes, { mode: 'fatal' })).toThrow();
      });
    });

    it('should use replacement character for undefined bytes in replacement mode', () => {
      const bytes = new Uint8Array([0x48, 0x81, 0x8d, 0x8f, 0x90, 0x9d, 0x65]);
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFD\uFFFD\uFFFD\uFFFD\uFFFDe');
    });
  });

  describe('encode with surrogates and non-BMP characters', () => {
    it('should throw for lone high surrogate in fatal mode', () => {
      const loneHigh = '\uD83D'; // high surrogate without low surrogate
      expect(() => encode(loneHigh, { mode: 'fatal' })).toThrow();
      expect(() => encode(loneHigh, { mode: 'fatal' })).toThrow(
        /cannot be encoded/,
      );
    });

    it('should replace lone high surrogate in replacement mode', () => {
      const loneHigh = '\uD83D';
      const encoded = encode(loneHigh, { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([0x3f]); // '?'
    });

    it('should throw for lone low surrogate in fatal mode', () => {
      const loneLow = '\uDC4A'; // low surrogate without preceding high surrogate
      expect(() => encode(loneLow, { mode: 'fatal' })).toThrow();
    });

    it('should replace lone low surrogate in replacement mode', () => {
      const loneLow = '\uDC4A';
      const encoded = encode(loneLow, { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([0x3f]);
    });

    it('should properly skip surrogate pair and produce single replacement', () => {
      const s = 'A\u{1F60A}B'; // A + emoji (surrogate pair) + B
      // Fatal mode should throw
      expect(() => encode(s, { mode: 'fatal' })).toThrow();
      // Replacement mode should produce A + ? + B (single ? for the emoji)
      const encoded = encode(s, { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([0x41, 0x3f, 0x42]);
    });

    it('should handle multiple non-BMP characters', () => {
      const s = '\u{1F600}\u{1F601}\u{1F602}'; // three emojis
      const encoded = encode(s, { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([0x3f, 0x3f, 0x3f]);
    });

    it('should handle mixed BMP and non-BMP characters', () => {
      const s = 'A\u{1F60A}€\u{1F389}B'; // A + emoji + euro + emoji + B
      const encoded = encode(s, { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([0x41, 0x3f, 0x80, 0x3f, 0x42]);
    });
  });

  describe('boundary conditions for encode', () => {
    it('should handle characters at ASCII boundary (0x7F)', () => {
      const encoded = encode('\x7F'); // DEL character
      expect(Array.from(encoded)).toEqual([0x7f]);
    });

    it('should handle characters at Windows-1252 boundaries', () => {
      // 0x80 (first Windows-1252 special) and 0x9F (last)
      const encoded = encode('\u20AC\u0178'); // € and Ÿ
      expect(Array.from(encoded)).toEqual([0x80, 0x9f]);
    });

    it('should handle characters at Latin-1 boundaries', () => {
      // 0xA0 (first Latin-1) and 0xFF (last)
      const encoded = encode('\u00A0\u00FF'); // non-breaking space and ÿ
      expect(Array.from(encoded)).toEqual([0xa0, 0xff]);
    });

    it('should throw for character just outside encodable range (0x100)', () => {
      const char = String.fromCharCode(0x100); // Latin Extended-A
      expect(() => encode(char, { mode: 'fatal' })).toThrow();
    });
  });

  describe('boundary conditions for decode', () => {
    it('should handle byte 0x00 (null)', () => {
      const bytes = new Uint8Array([0x00]);
      const decoded = decode(bytes);
      expect(decoded).toBe('\x00');
      expect(decoded.charCodeAt(0)).toBe(0);
    });

    it('should handle byte 0x7F (DEL)', () => {
      const bytes = new Uint8Array([0x7f]);
      const decoded = decode(bytes);
      expect(decoded.charCodeAt(0)).toBe(0x7f);
    });

    it('should handle byte 0x80 (first special Windows-1252)', () => {
      const bytes = new Uint8Array([0x80]);
      expect(decode(bytes)).toBe('\u20AC');
    });

    it('should handle byte 0x9F (last special Windows-1252)', () => {
      const bytes = new Uint8Array([0x9f]);
      expect(decode(bytes)).toBe('\u0178');
    });

    it('should handle byte 0xA0 (first Latin-1 supplement)', () => {
      const bytes = new Uint8Array([0xa0]);
      expect(decode(bytes)).toBe('\u00A0');
    });

    it('should handle byte 0xFF (last byte)', () => {
      const bytes = new Uint8Array([0xff]);
      expect(decode(bytes)).toBe('\u00FF');
    });
  });

  describe('error message validation', () => {
    it('should provide detailed error for unencodable character with code point', () => {
      try {
        encode('😊', { mode: 'fatal' });
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toMatch(/U\+1F60A/);
        expect(e.message).toMatch(/cannot be encoded/);
      }
    });

    it('should provide detailed error for invalid byte in decode', () => {
      try {
        decode([300], { mode: 'fatal' });
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toMatch(/Invalid byte value: 300/);
        expect(e.message).toMatch(/must be 0-255/);
      }
    });

    it('should provide hex format for undefined Windows-1252 bytes', () => {
      try {
        decode(new Uint8Array([0x8d]), { mode: 'fatal' });
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toMatch(/0x8D/);
      }
    });
  });

  describe('special character combinations', () => {
    it('should handle consecutive undefined bytes', () => {
      const bytes = new Uint8Array([0x81, 0x81, 0x8d, 0x8d]);
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded).toBe('\uFFFD\uFFFD\uFFFD\uFFFD');
    });

    it('should handle alternating valid and invalid bytes', () => {
      const bytes = new Uint8Array([0x48, 0x81, 0x65, 0x8d, 0x6c, 0x8f]);
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFDe\uFFFDl\uFFFD');
    });

    it('should encode string with multiple consecutive unencodable chars', () => {
      const encoded = encode('ABC你好世界DEF', { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([
        0x41,
        0x42,
        0x43, // ABC
        0x3f,
        0x3f,
        0x3f,
        0x3f, // ????
        0x44,
        0x45,
        0x46, // DEF
      ]);
    });
  });

  describe('array length edge cases', () => {
    it('should handle single byte array', () => {
      const bytes = new Uint8Array([0x41]);
      expect(decode(bytes)).toBe('A');
    });

    it('should handle single character string', () => {
      const encoded = encode('A');
      expect(Array.from(encoded)).toEqual([0x41]);
    });

    it('should handle very long byte arrays', () => {
      const bytes = new Uint8Array(10000);
      bytes.fill(0x41); // Fill with 'A'
      const decoded = decode(bytes);
      expect(decoded.length).toBe(10000);
      expect(decoded[0]).toBe('A');
      expect(decoded[9999]).toBe('A');
    });

    it('should handle very long strings', () => {
      const str = 'A'.repeat(10000);
      const encoded = encode(str);
      expect(encoded.length).toBe(10000);
      expect(encoded[0]).toBe(0x41);
      expect(encoded[9999]).toBe(0x41);
    });
  });
});
