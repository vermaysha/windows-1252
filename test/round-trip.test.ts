import { describe, it, expect } from 'bun:test';
import { encode, decode } from '../src';

describe('round-trip encoding/decoding', () => {
  it('should round-trip ASCII text', () => {
    const original = 'Hello, World!';
    const encoded = encode(original);
    const decoded = decode(encoded);
    expect(decoded).toBe(original);
  });

  it('should round-trip Windows-1252 specific characters', () => {
    const original =
      '\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178';
    const encoded = encode(original);
    const decoded = decode(encoded);
    expect(decoded).toBe(original);
  });

  it('should round-trip Latin-1 supplement characters', () => {
    const original = 'àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ';
    const encoded = encode(original);
    const decoded = decode(encoded);
    expect(decoded).toBe(original);
  });

  it('should round-trip mixed content', () => {
    const original = "Café costs \u20AC5.00 \u2014 that's £4.50!";
    const encoded = encode(original);
    const decoded = decode(encoded);
    expect(decoded).toBe(original);
  });

  it('should round-trip all encodable Windows-1252 characters', () => {
    let original = '';
    // ASCII range
    for (let i = 0x20; i < 0x7f; i++) {
      original += String.fromCharCode(i);
    }
    // Windows-1252 specific
    original +=
      '\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178';
    // Latin-1 supplement
    for (let i = 0xa0; i <= 0xff; i++) {
      original += String.fromCharCode(i);
    }

    const encoded = encode(original);
    const decoded = decode(encoded);
    expect(decoded).toBe(original);
  });

  it('should round-trip with control characters', () => {
    const original = 'Line1\nLine2\r\nLine3\tTabbed';
    const encoded = encode(original);
    const decoded = decode(encoded);
    expect(decoded).toBe(original);
  });

  it('should round-trip empty string', () => {
    const original = '';
    const encoded = encode(original);
    const decoded = decode(encoded);
    expect(decoded).toBe(original);
  });

  it('should round-trip long text', () => {
    const original =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
      "Price: \u20AC100 \u2014 that's a deal! Don't miss it\u2026";
    const encoded = encode(original);
    const decoded = decode(encoded);
    expect(decoded).toBe(original);
  });

  it('should handle round-trip with replacement mode for encoding', () => {
    const original = 'Hello \u{1F60A} World';
    const encoded = encode(original, { mode: 'replacement' });
    const decoded = decode(encoded);
    expect(decoded).toBe('Hello ? World');
  });

  describe('byte-perfect round-trips', () => {
    it('should produce identical bytes after round-trip', () => {
      const originalBytes = new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x80, 0x99, 0xe9,
      ]);
      const decoded = decode(originalBytes);
      const encoded = encode(decoded);
      expect(Array.from(encoded)).toEqual(Array.from(originalBytes));
    });

    it('should handle all encodable byte values', () => {
      // Skip control characters in Windows-1252 range that shouldn't round-trip
      const skipBytes = [0x81, 0x8d, 0x8f, 0x90, 0x9d];
      const originalBytes: number[] = [];
      for (let i = 0; i < 256; i++) {
        if (!skipBytes.includes(i)) {
          originalBytes.push(i);
        }
      }
      const bytes = new Uint8Array(originalBytes);
      const decoded = decode(bytes);
      const encoded = encode(decoded);
      expect(Array.from(encoded)).toEqual(originalBytes);
    });
  });
});
