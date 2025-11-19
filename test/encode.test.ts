import { describe, it, expect } from 'bun:test';
import { encode } from '../src';

describe('encode', () => {
  describe('ASCII range', () => {
    it('should encode basic ASCII text', () => {
      const encoded = encode('Hello');
      expect(Array.from(encoded)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    });

    it('should encode all ASCII printable characters', () => {
      const text =
        ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
      const encoded = encode(text);
      for (let i = 0; i < text.length; i++) {
        expect(encoded[i]).toBe(text.charCodeAt(i));
      }
    });

    it('should encode control characters', () => {
      const encoded = encode('\x00\t\n\r');
      expect(Array.from(encoded)).toEqual([0x00, 0x09, 0x0a, 0x0d]);
    });
  });

  describe('Windows-1252 specific characters', () => {
    it('should encode Euro sign', () => {
      const encoded = encode('\u20AC');
      expect(Array.from(encoded)).toEqual([0x80]);
    });

    it('should encode smart quotes', () => {
      const encoded = encode('\u2018\u2019\u201C\u201D');
      expect(Array.from(encoded)).toEqual([0x91, 0x92, 0x93, 0x94]);
    });

    it('should encode trademark symbol', () => {
      const encoded = encode('\u2122');
      expect(Array.from(encoded)).toEqual([0x99]);
    });

    it('should encode em dash and en dash', () => {
      const encoded = encode('\u2013\u2014');
      expect(Array.from(encoded)).toEqual([0x96, 0x97]);
    });

    it('should encode all Windows-1252 specific characters', () => {
      const text =
        '\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178';
      const encoded = encode(text);
      const expected = [
        0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c,
        0x8e, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b,
        0x9c, 0x9e, 0x9f,
      ];
      expect(Array.from(encoded)).toEqual(expected);
    });

    it('should encode bullet point', () => {
      const encoded = encode('\u2022');
      expect(Array.from(encoded)).toEqual([0x95]);
    });

    it('should encode ellipsis', () => {
      const encoded = encode('\u2026');
      expect(Array.from(encoded)).toEqual([0x85]);
    });
  });

  describe('Latin-1 supplement range', () => {
    it('should encode accented characters', () => {
      const encoded = encode('àéñü');
      expect(Array.from(encoded)).toEqual([0xe0, 0xe9, 0xf1, 0xfc]);
    });

    it('should encode non-breaking space', () => {
      const encoded = encode('\u00A0');
      expect(Array.from(encoded)).toEqual([0xa0]);
    });

    it('should encode copyright and registered symbols', () => {
      const encoded = encode('©®');
      expect(Array.from(encoded)).toEqual([0xa9, 0xae]);
    });

    it('should encode all Latin-1 supplement characters (0xA0-0xFF)', () => {
      let text = '';
      for (let i = 0xa0; i <= 0xff; i++) {
        text += String.fromCharCode(i);
      }
      const encoded = encode(text);
      expect(encoded.length).toBe(96);
      for (let i = 0; i < 96; i++) {
        expect(encoded[i]).toBe(0xa0 + i);
      }
    });
  });

  describe('error handling', () => {
    it('should throw in fatal mode for unencodable characters (default)', () => {
      expect(() => encode('Hello \u{1F60A}')).toThrow();
      expect(() => encode('Hello \u{1F60A}')).toThrow(/cannot be encoded/);
    });

    it('should throw in fatal mode for emoji', () => {
      expect(() => encode('\u{1F389}', { mode: 'fatal' })).toThrow();
    });

    it('should throw in fatal mode for Chinese characters', () => {
      expect(() => encode('你好', { mode: 'fatal' })).toThrow();
    });

    it('should throw in fatal mode for Cyrillic characters', () => {
      expect(() => encode('Привет', { mode: 'fatal' })).toThrow();
    });

    it('should replace unencodable characters with ? in replacement mode', () => {
      const encoded = encode('Hello \u{1F60A}', { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x3f,
      ]);
    });

    it('should replace multiple emojis in replacement mode', () => {
      const encoded = encode('A\u{1F60A}B\u{1F389}C', { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([0x41, 0x3f, 0x42, 0x3f, 0x43]);
    });

    it('should replace Chinese characters in replacement mode', () => {
      const encoded = encode('你好', { mode: 'replacement' });
      expect(Array.from(encoded)).toEqual([0x3f, 0x3f]);
    });
  });

  describe('mixed content', () => {
    it('should encode mixed ASCII, Windows-1252, and Latin-1', () => {
      const encoded = encode('Hello \u20AC\u2122é');
      expect(Array.from(encoded)).toEqual([
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
    });
  });

  it('should handle empty strings', () => {
    const encoded = encode('');
    expect(encoded.length).toBe(0);
  });
});
