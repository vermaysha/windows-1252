import { describe, it, expect } from 'bun:test';
import { encode, decode } from '../src';

describe('stress and performance tests', () => {
  describe('large input handling', () => {
    it('should handle encoding 100KB of ASCII text', () => {
      const largeText = 'A'.repeat(100_000);
      const encoded = encode(largeText);
      expect(encoded.length).toBe(100_000);
      expect(encoded[0]).toBe(0x41);
      expect(encoded[99_999]).toBe(0x41);
    });

    it('should handle decoding 100KB of bytes', () => {
      const largeBytes = new Uint8Array(100_000);
      largeBytes.fill(0x41);
      const decoded = decode(largeBytes);
      expect(decoded.length).toBe(100_000);
      expect(decoded[0]).toBe('A');
    });

    it('should handle encoding mixed content at scale', () => {
      const pattern = 'Hello €100 — Café\n';
      const largeText = pattern.repeat(5_000); // ~100KB
      const encoded = encode(largeText);
      expect(encoded.length).toBe(pattern.length * 5_000);

      // Verify round-trip
      const decoded = decode(encoded);
      expect(decoded).toBe(largeText);
    });

    it('should handle decoding mixed bytes at scale', () => {
      const pattern = new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x80, 0xe9,
      ]);
      const largeBytes = new Uint8Array(pattern.length * 10_000);
      for (let i = 0; i < 10_000; i++) {
        largeBytes.set(pattern, i * pattern.length);
      }

      const decoded = decode(largeBytes);
      expect(decoded.length).toBe(pattern.length * 10_000);
    });
  });

  describe('repeated pattern handling', () => {
    it('should handle repeated Windows-1252 special characters', () => {
      const repeated = '\u20AC'.repeat(1_000); // Euro sign repeated
      const encoded = encode(repeated);
      expect(encoded.length).toBe(1_000);
      expect(encoded.every((b) => b === 0x80)).toBe(true);

      const decoded = decode(encoded);
      expect(decoded).toBe(repeated);
    });

    it('should handle repeated undefined bytes with replacement', () => {
      const bytes = new Uint8Array(1_000);
      bytes.fill(0x81); // undefined byte
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded.length).toBe(1_000);
      expect(decoded).toBe('\uFFFD'.repeat(1_000));
    });

    it('should handle alternating valid/invalid patterns', () => {
      const bytes = new Uint8Array(2_000);
      for (let i = 0; i < 1_000; i++) {
        bytes[i * 2] = 0x48; // 'H'
        bytes[i * 2 + 1] = 0x81; // undefined
      }
      const decoded = decode(bytes, { mode: 'replacement' });
      expect(decoded).toBe('H\uFFFD'.repeat(1_000));
    });

    it('should handle encoding with many replacements', () => {
      const str = 'A😊'.repeat(1_000); // 1000 ASCII + 1000 emojis
      const encoded = encode(str, { mode: 'replacement' });
      expect(encoded.length).toBe(2_000); // A? repeated

      // Verify pattern
      for (let i = 0; i < 1_000; i++) {
        expect(encoded[i * 2]).toBe(0x41); // A
        expect(encoded[i * 2 + 1]).toBe(0x3f); // ?
      }
    });
  });

  describe('all-byte permutations', () => {
    it('should handle sequential bytes from 0 to 255', () => {
      const bytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        bytes[i] = i;
      }

      const decoded = decode(bytes);
      expect(decoded.length).toBeGreaterThan(0);

      // Verify it contains expected replacements for undefined bytes
      const replacementCount = (decoded.match(/\uFFFD/g) || []).length;
      expect(replacementCount).toBe(5); // 0x81, 0x8D, 0x8F, 0x90, 0x9D
    });

    it('should handle reverse sequential bytes from 255 to 0', () => {
      const bytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        bytes[i] = 255 - i;
      }

      const decoded = decode(bytes);
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should handle random-ish byte patterns', () => {
      const bytes = new Uint8Array(1_000);
      for (let i = 0; i < 1_000; i++) {
        // Pseudo-random pattern avoiding simple modulo
        bytes[i] = ((i * 17 + 37) * 13) & 0xff;
      }

      const decoded = decode(bytes);
      expect(decoded.length).toBe(1_000);
    });
  });

  describe('concatenation and splitting', () => {
    it('should handle decoding split byte arrays', () => {
      const full = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      const part1 = new Uint8Array([0x48, 0x65]);
      const part2 = new Uint8Array([0x6c, 0x6c, 0x6f]);

      const fullDecoded = decode(full);
      const partDecoded = decode(part1) + decode(part2);

      expect(partDecoded).toBe(fullDecoded);
    });

    it('should handle encoding split strings', () => {
      const full = 'Hello';
      const part1 = 'He';
      const part2 = 'llo';

      const fullEncoded = encode(full);
      const part1Encoded = encode(part1);
      const part2Encoded = encode(part2);

      const combined = new Uint8Array(
        part1Encoded.length + part2Encoded.length,
      );
      combined.set(part1Encoded, 0);
      combined.set(part2Encoded, part1Encoded.length);

      expect(Array.from(combined)).toEqual(Array.from(fullEncoded));
    });

    it('should handle multiple small decode operations', () => {
      const results: string[] = [];
      for (let i = 0; i < 1_000; i++) {
        const bytes = new Uint8Array([0x41 + (i % 26)]); // A-Z cycling
        results.push(decode(bytes));
      }
      expect(results.length).toBe(1_000);
      expect(results[0]).toBe('A');
    });

    it('should handle multiple small encode operations', () => {
      const results: Uint8Array[] = [];
      for (let i = 0; i < 1_000; i++) {
        const char = String.fromCharCode(0x41 + (i % 26));
        results.push(encode(char));
      }
      expect(results.length).toBe(1_000);
      expect(results[0]![0]).toBe(0x41);
    });
  });

  describe('mixed mode operations at scale', () => {
    it('should handle many decode operations with different modes', () => {
      const validBytes = new Uint8Array([0x48, 0x69]);
      const invalidBytes = new Uint8Array([0x81]);

      for (let i = 0; i < 100; i++) {
        expect(decode(validBytes)).toBe('Hi');
        expect(decode(invalidBytes, { mode: 'replacement' })).toBe('\uFFFD');
        expect(() => decode(invalidBytes, { mode: 'fatal' })).toThrow();
      }
    });

    it('should handle many encode operations with different modes', () => {
      const validStr = 'Hi';
      const invalidStr = '😊';

      for (let i = 0; i < 100; i++) {
        expect(Array.from(encode(validStr))).toEqual([0x48, 0x69]);
        expect(Array.from(encode(invalidStr, { mode: 'replacement' }))).toEqual(
          [0x3f],
        );
        expect(() => encode(invalidStr, { mode: 'fatal' })).toThrow();
      }
    });
  });

  describe('memory efficiency', () => {
    it('should properly size output for decode', () => {
      const bytes = new Uint8Array([0x48, 0x69]);
      const decoded = decode(bytes);
      expect(decoded.length).toBe(2);
    });

    it('should properly size output for encode', () => {
      const str = 'Hi';
      const encoded = encode(str);
      expect(encoded.length).toBe(2);
      expect(encoded.buffer.byteLength).toBeGreaterThanOrEqual(2);
    });

    it('should handle subarray correctly after encode', () => {
      const str = 'Hello';
      const encoded = encode(str);
      const subarray = encoded.subarray(0, 2);
      expect(Array.from(subarray)).toEqual([0x48, 0x65]);
    });
  });

  describe('real-world text patterns', () => {
    it('should handle typical English text', () => {
      const text = 'The quick brown fox jumps over the lazy dog. '.repeat(100);
      const encoded = encode(text);
      const decoded = decode(encoded);
      expect(decoded).toBe(text);
    });

    it('should handle typical European text with accents', () => {
      const text = 'Café français, Zürich, España, naïve. '.repeat(100);
      const encoded = encode(text);
      const decoded = decode(encoded);
      expect(decoded).toBe(text);
    });

    it('should handle Windows-1252 common punctuation', () => {
      const text =
        '\u201CHello,\u201D he said\u2014it\u2019s \u20AC10.99\u2026 '.repeat(
          100,
        );
      const encoded = encode(text);
      const decoded = decode(encoded);
      expect(decoded).toBe(text);
    });

    it('should handle HTML-like content', () => {
      const text =
        '<p>Price: \u20AC100 \u2014 that\u2019s a deal!</p>\n'.repeat(100);
      const encoded = encode(text);
      const decoded = decode(encoded);
      expect(decoded).toBe(text);
    });

    it('should handle CSV-like data', () => {
      const text =
        'Name,Price,Notes\nProduct,\u20AC10.50,"It\u2019s great\u2014buy now\u2026"\n'.repeat(
          100,
        );
      const encoded = encode(text);
      const decoded = decode(encoded);
      expect(decoded).toBe(text);
    });
  });
});
