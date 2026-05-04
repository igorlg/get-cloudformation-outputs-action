import { describe, expect, it } from 'vitest';
import { selectOutputs } from './select';

const allOutputs = new Map<string, string>([
  ['ApiUrl', 'https://api.example.com'],
  ['BucketName', 'my-bucket'],
  ['QueueArn', 'arn:aws:sqs:...'],
]);

describe('selectOutputs', () => {
  it('returns all outputs when requested is empty', () => {
    const result = selectOutputs(allOutputs, [], true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.fromEntries(result.value)).toEqual({
        ApiUrl: 'https://api.example.com',
        BucketName: 'my-bucket',
        QueueArn: 'arn:aws:sqs:...',
      });
    }
  });

  it('returns only requested outputs in request order', () => {
    const result = selectOutputs(allOutputs, ['BucketName', 'ApiUrl'], true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.value.keys()]).toEqual(['BucketName', 'ApiUrl']);
    }
  });

  it('fails when requested output is missing and failOnMissing=true', () => {
    const result = selectOutputs(allOutputs, ['ApiUrl', 'Nope'], true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('RequestedOutputsMissing');
      if (result.error.tag === 'RequestedOutputsMissing') {
        expect(result.error.names).toEqual(['Nope']);
      }
    }
  });

  it('collects all missing names in one error', () => {
    const result = selectOutputs(allOutputs, ['ApiUrl', 'Nope', 'Missing'], true);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.tag === 'RequestedOutputsMissing') {
      expect(result.error.names).toEqual(['Nope', 'Missing']);
    }
  });

  it('skips missing outputs when failOnMissing=false', () => {
    const result = selectOutputs(allOutputs, ['ApiUrl', 'Nope'], false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.fromEntries(result.value)).toEqual({
        ApiUrl: 'https://api.example.com',
      });
    }
  });

  it('returns empty map when all requested are missing and failOnMissing=false', () => {
    const result = selectOutputs(allOutputs, ['A', 'B'], false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.size).toBe(0);
  });

  it('is case-sensitive (matches CFN behaviour)', () => {
    const result = selectOutputs(allOutputs, ['apiurl'], true);
    expect(result.ok).toBe(false);
  });
});
