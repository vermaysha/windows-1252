import { describe, it, expect } from 'bun:test';
import { decode } from '../src';

describe('decode', () => {
  describe('ASCII range (0x00-0x7F)', () => {
    it('should decode basic ASCII characters', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      expect(decode(bytes)).toBe('Hello');
    });

    it('should decode all ASCII printable characters', () => {
      const bytes = new Uint8Array(95);
      for (let i = 0; i < 95; i++) {
        bytes[i] = 0x20 + i; // Space (0x20) to ~ (0x7E)
      }
      const decoded = decode(bytes);
      expect(decoded).toBe(
        ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
      );
    });

    it('should decode control characters (0x00-0x1F)', () => {
      const bytes = new Uint8Array([0x00, 0x09, 0x0a, 0x0d]);
      const decoded = decode(bytes);
      expect(decoded).toBe('\x00\t\n\r');
    });
  });

  describe('Windows-1252 specific range (0x80-0x9F)', () => {
    it('should decode Euro sign (0x80)', () => {
      const bytes = new Uint8Array([0x80]);
      expect(decode(bytes)).toBe('\u20AC');
    });

    it('should decode smart quotes', () => {
      const bytes = new Uint8Array([0x91, 0x92, 0x93, 0x94]);
      expect(decode(bytes)).toBe('\u2018\u2019\u201C\u201D');
    });

    it('should decode trademark symbol (0x99)', () => {
      const bytes = new Uint8Array([0x99]);
      expect(decode(bytes)).toBe('\u2122');
    });

    it('should decode em dash and en dash', () => {
      const bytes = new Uint8Array([0x96, 0x97]);
      expect(decode(bytes)).toBe('\u2013\u2014');
    });

    it('should decode all Windows-1252 specific characters', () => {
      const bytes = new Uint8Array([
        0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c,
        0x8e, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b,
        0x9c, 0x9e, 0x9f,
      ]);
      const expected =
        '\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178';
      expect(decode(bytes)).toBe(expected);
    });

    it('should decode undefined bytes as replacement characters', () => {
      const bytes = new Uint8Array([0x81, 0x8d, 0x8f, 0x90, 0x9d]);
      const decoded = decode(bytes);
      // These undefined bytes should all become U+FFFD per WHATWG spec
      expect(decoded).toBe('\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD');
      expect(decoded.codePointAt(0)).toBe(0xfffd);
      expect(decoded.codePointAt(1)).toBe(0xfffd);
      expect(decoded.codePointAt(2)).toBe(0xfffd);
      expect(decoded.codePointAt(3)).toBe(0xfffd);
      expect(decoded.codePointAt(4)).toBe(0xfffd);
    });
  });

  describe('ISO-8859-1 range (0xA0-0xFF)', () => {
    it('should decode Latin-1 supplement characters', () => {
      const bytes = new Uint8Array([0xe0, 0xe9, 0xf1, 0xfc]);
      expect(decode(bytes)).toBe('àéñü');
    });

    it('should decode non-breaking space (0xA0)', () => {
      const bytes = new Uint8Array([0xa0]);
      expect(decode(bytes)).toBe('\u00A0');
    });

    it('should decode copyright and registered symbols', () => {
      const bytes = new Uint8Array([0xa9, 0xae]);
      expect(decode(bytes)).toBe('©®');
    });

    it('should decode all characters from 0xA0 to 0xFF', () => {
      const bytes = new Uint8Array(96);
      for (let i = 0; i < 96; i++) {
        bytes[i] = 0xa0 + i;
      }
      const decoded = decode(bytes);
      expect(decoded.length).toBe(96);
      expect(decoded.charCodeAt(0)).toBe(0xa0);
      expect(decoded.charCodeAt(95)).toBe(0xff);
    });
  });

  describe('error handling', () => {
    it('should throw in fatal mode for out-of-range values in regular arrays', () => {
      const bytes = [0x48, 256, 0x65]; // Regular array can have values > 255
      expect(() => decode(bytes, { mode: 'fatal' })).toThrow();
    });

    it('should use replacement character for out-of-range values in regular arrays', () => {
      const bytes = [0x48, 300, 0x65]; // Regular array
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFDe');
    });

    it('should decode 0xFF as ÿ (not replacement character)', () => {
      const bytes = new Uint8Array([0x48, 0xff, 0x65]); // 0xFF is valid (ÿ)
      const decoded = decode(bytes);
      expect(decoded).toBe('Hÿe');
    });
  });

  describe('mixed content', () => {
    it('should decode mixed ASCII, Windows-1252, and Latin-1', () => {
      const bytes = new Uint8Array([
        0x48,
        0x65,
        0x6c,
        0x6c,
        0x6f, // "Hello"
        0x20, // space
        0x80, // €
        0x99, // ™
        0xe9, // é
      ]);
      expect(decode(bytes)).toBe('Hello \u20AC\u2122é');
    });
  });

  it('should handle empty arrays', () => {
    expect(decode(new Uint8Array([]))).toBe('');
  });

  it('should accept regular number arrays', () => {
    const bytes = [0x48, 0x65, 0x6c, 0x6c, 0x6f];
    expect(decode(bytes)).toBe('Hello');
  });
});
