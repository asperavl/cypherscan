import { describe, it, expect } from 'vitest';
import { RequestSchema } from '@/lib/validations';

describe('RequestSchema validation', () => {
  it('accepts valid payloads for supported regions', () => {
    const validRegions = ['na', 'eu', 'ap', 'kr'] as const;

    for (const region of validRegions) {
      const result = RequestSchema.safeParse({
        name: 'TenZ',
        tag: 'NA1',
        region
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.region).toBe(region);
        expect(result.data.name).toBe('TenZ');
        expect(result.data.tag).toBe('NA1');
      }
    }
  });

  it('trims whitespace around name and tag', () => {
    const result = RequestSchema.safeParse({
      name: '  Shroud  ',
      tag: '  1234  ',
      region: 'na'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Shroud');
      expect(result.data.tag).toBe('1234');
    }
  });

  it('rejects unsupported regions', () => {
    const result = RequestSchema.safeParse({
      name: 'Player',
      tag: '1234',
      region: 'oce'
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty or missing names', () => {
    const emptyName = RequestSchema.safeParse({
      name: '',
      tag: '1234',
      region: 'na'
    });
    expect(emptyName.success).toBe(false);

    const missingName = RequestSchema.safeParse({
      tag: '1234',
      region: 'na'
    });
    expect(missingName.success).toBe(false);
  });

  it('rejects empty or missing tags', () => {
    const emptyTag = RequestSchema.safeParse({
      name: 'Player',
      tag: '',
      region: 'na'
    });
    expect(emptyTag.success).toBe(false);

    const missingTag = RequestSchema.safeParse({
      name: 'Player',
      region: 'na'
    });
    expect(missingTag.success).toBe(false);
  });
});
