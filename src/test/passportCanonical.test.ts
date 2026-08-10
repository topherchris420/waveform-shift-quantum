import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  canonicalNumber,
  sha256Bytes,
  sha256Text,
  utf8,
} from '../lib/passport/canonical';

describe('passport canonical identity', () => {
  it('canonicalizes numbers with stable scientific formatting', () => {
    expect(canonicalNumber(-0)).toBe('0');
    expect(canonicalNumber(1.25)).toBe('1.250000000000e+0');
  });

  it('canonicalizes nested JSON with sorted keys', () => {
    expect(canonicalJson({ z: -0, a: [1.25, true, null] })).toBe(
      '{"a":[1.250000000000e+0,true,null],"z":0}'
    );
  });

  it('omits only explicitly named object keys and rejects undefined values', () => {
    expect(
      canonicalJson(
        {
          keep: 1.25,
          drop: 'x',
          nested: {
            keep: true,
            drop: 'y',
          },
        },
        { omitKeys: ['drop'] }
      )
    ).toBe('{"keep":1.250000000000e+0,"nested":{"keep":true}}');

    expect(() => canonicalJson({ keep: undefined })).toThrow(/undefined/i);
  });

  it('hashes text and byte subarrays identically with SHA-256', async () => {
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const bytes = utf8('zabcq').subarray(1, 4);

    await expect(sha256Text('abc')).resolves.toBe(expected);
    await expect(sha256Bytes(bytes)).resolves.toBe(expected);
  });
});
