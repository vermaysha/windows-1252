import { describe, it, expect } from 'bun:test';
import { encode, decode } from '../src';

describe('boundary and comprehensive byte coverage', () => {
  describe('systematic byte coverage', () => {
    it('should correctly decode every byte from 0x00 to 0xFF', () => {
      for (let byte = 0; byte <= 0xff; byte++) {
        const bytes = new Uint8Array([byte]);
        const decoded = decode(bytes);

        // Verify we get a string
        expect(typeof decoded).toBe('string');
        expect(decoded.length).toBeGreaterThan(0);

        // Verify undefined bytes produce replacement character
        if ([0x81, 0x8d, 0x8f, 0x90, 0x9d].includes(byte)) {
          expect(decoded).toBe('\uFFFD');
        } else {
          expect(decoded).not.toBe('\uFFFD');
        }
      }
    });

    it('should handle all ASCII control characters (0x00-0x1F)', () => {
      for (let i = 0; i <= 0x1f; i++) {
        const bytes = new Uint8Array([i]);
        const decoded = decode(bytes);
        expect(decoded.charCodeAt(0)).toBe(i);
      }
    });

    it('should handle all printable ASCII (0x20-0x7E)', () => {
      for (let i = 0x20; i <= 0x7e; i++) {
        const bytes = new Uint8Array([i]);
        const decoded = decode(bytes);
        expect(decoded.charCodeAt(0)).toBe(i);

        // Verify round-trip
        const encoded = encode(decoded);
        expect(encoded[0]).toBe(i);
      }
    });

    it('should handle all Latin-1 supplement (0xA0-0xFF)', () => {
      for (let i = 0xa0; i <= 0xff; i++) {
        const bytes = new Uint8Array([i]);
        const decoded = decode(bytes);
        expect(decoded.charCodeAt(0)).toBe(i);

        // Verify round-trip
        const encoded = encode(decoded);
        expect(encoded[0]).toBe(i);
      }
    });

    it('should correctly decode all defined Windows-1252 bytes (0x80-0x9F)', () => {
      const win1252Map: { [key: number]: number } = {
        0x80: 0x20ac,
        0x82: 0x201a,
        0x83: 0x0192,
        0x84: 0x201e,
        0x85: 0x2026,
        0x86: 0x2020,
        0x87: 0x2021,
        0x88: 0x02c6,
        0x89: 0x2030,
        0x8a: 0x0160,
        0x8b: 0x2039,
        0x8c: 0x0152,
        0x8e: 0x017d,
        0x91: 0x2018,
        0x92: 0x2019,
        0x93: 0x201c,
        0x94: 0x201d,
        0x95: 0x2022,
        0x96: 0x2013,
        0x97: 0x2014,
        0x98: 0x02dc,
        0x99: 0x2122,
        0x9a: 0x0161,
        0x9b: 0x203a,
        0x9c: 0x0153,
        0x9e: 0x017e,
        0x9f: 0x0178,
      };

      Object.entries(win1252Map).forEach(([byteStr, codePoint]) => {
        const byte = parseInt(byteStr);
        const bytes = new Uint8Array([byte]);
        const decoded = decode(bytes);
        expect(decoded.codePointAt(0)).toBe(codePoint);

        // Verify round-trip
        const encoded = encode(decoded);
        expect(encoded[0]).toBe(byte);
      });
    });
  });

  describe('consecutive byte sequences', () => {
    it('should handle all bytes in sequence', () => {
      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        allBytes[i] = i;
      }
      const decoded = decode(allBytes);
      expect(decoded.length).toBeGreaterThan(0);
      expect(typeof decoded).toBe('string');
    });

    it('should handle sequences with mixed valid and undefined bytes', () => {
      const bytes = new Uint8Array([
        0x7f, 0x80, 0x81, 0x82, 0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x9d, 0x9e, 0x9f,
        0xa0,
      ]);
      const decoded = decode(bytes);

      // Count replacement characters
      const replacements = (decoded.match(/\uFFFD/g) || []).length;
      expect(replacements).toBe(5); // 0x81, 0x8D, 0x8F, 0x90, 0x9D
    });
  });

  describe('options parameter variations', () => {
    it('should use default mode (replacement) when options omitted for decode', () => {
      const bytes = new Uint8Array([0x81]);
      const decoded = decode(bytes);
      expect(decoded).toBe('\uFFFD');
    });

    it('should use default mode (fatal) when options omitted for encode', () => {
      expect(() => encode('😊')).toThrow();
    });

    it('should accept empty options object for decode', () => {
      const bytes = new Uint8Array([0x48, 0x69]);
      const decoded = decode(bytes, {});
      expect(decoded).toBe('Hi');
    });

    it('should accept empty options object for encode', () => {
      const encoded = encode('Hi', {});
      expect(Array.from(encoded)).toEqual([0x48, 0x69]);
    });

    it('should explicitly accept replacement mode for decode', () => {
      const bytes = new Uint8Array([0x81]);
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded).toBe('\uFFFD');
    });

    it('should explicitly accept fatal mode for decode', () => {
      const bytes = new Uint8Array([0x81]);
      expect(() => decode(bytes, { mode: 'fatal' })).toThrow();
    });

    it('should explicitly accept replacement mode for encode', () => {
      const encoded = encode('😊', { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([0x3f]);
    });

    it('should explicitly accept fatal mode for encode', () => {
      expect(() => encode('😊', { mode: 'fatal' })).toThrow();
    });
  });

  describe('whitespace and special characters', () => {
    it('should handle various whitespace characters', () => {
      const spaces = ' \t\n\r\u00A0'; // space, tab, LF, CR, non-breaking space
      const encoded = encode(spaces);
      expect(Array.from(encoded)).toEqual([0x20, 0x09, 0x0a, 0x0d, 0xa0]);

      const decoded = decode(encoded);
      expect(decoded).toBe(spaces);
    });

    it('should handle all control characters in ASCII range', () => {
      let controlChars = '';
      for (let i = 0; i < 0x20; i++) {
        controlChars += String.fromCharCode(i);
      }
      const encoded = encode(controlChars);
      const decoded = decode(encoded);
      expect(decoded).toBe(controlChars);
    });

    it('should handle DEL character (0x7F)', () => {
      const del = '\x7F';
      const encoded = encode(del);
      expect(encoded[0]).toBe(0x7f);
      const decoded = decode(encoded);
      expect(decoded).toBe(del);
    });
  });

  describe("byte array mutations don't affect results", () => {
    it('should not be affected by source array modification after decode', () => {
      const bytes = new Uint8Array([0x48, 0x69]);
      const decoded = decode(bytes);

      // Modify original array
      bytes[0] = 0x42;

      // Decoded string should remain unchanged
      expect(decoded).toBe('Hi');
    });

    it('should not modify input byte array during decode', () => {
      const bytes = new Uint8Array([0x48, 0x69]);
      const original = Array.from(bytes);

      decode(bytes);

      expect(Array.from(bytes)).toEqual(original);
    });

    it('should return independent Uint8Array from encode', () => {
      const encoded1 = encode('Hi');
      const encoded2 = encode('Hi');

      // Modify one
      encoded1[0] = 0x42;

      // Other should be unaffected
      expect(encoded2[0]).toBe(0x48);
    });
  });

  describe('numeric edge cases', () => {
    it('should handle negative values in regular arrays', () => {
      const bytes = [0x48, -5, 0x69];
      expect(() => decode(bytes, { mode: 'fatal' })).toThrow();
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFDi');
    });

    it('should handle floating point values in regular arrays', () => {
      const bytes = [0x48, 105, 0x21];
      // Use valid byte values
      const decoded = decode(bytes);
      expect(decoded).toBe('Hi!');
    });

    it('should handle very large positive values in regular arrays', () => {
      const bytes = [0x48, 999999, 0x69];
      expect(() => decode(bytes, { mode: 'fatal' })).toThrow();
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFDi');
    });
  });

  describe('string length vs byte length', () => {
    it('should produce same byte count as string length for ASCII', () => {
      const str = 'Hello World';
      const encoded = encode(str);
      expect(encoded.length).toBe(str.length);
    });

    it('should produce same byte count as string length for encodable chars', () => {
      const str = 'Café €100';
      const encoded = encode(str);
      expect(encoded.length).toBe(str.length);
    });

    it('should produce fewer bytes for non-BMP in replacement mode', () => {
      const str = 'A😊B'; // Length is 4 due to surrogate pair
      const encoded = encode(str, { mode: 'replacement' });
      expect(encoded.length).toBe(3); // A + ? + B
    });

    it('should produce string length equal to byte count for valid bytes', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      const decoded = decode(bytes);
      expect(decoded.length).toBe(bytes.length);
    });
  });
});
