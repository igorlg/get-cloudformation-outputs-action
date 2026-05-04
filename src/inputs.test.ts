import { describe, expect, it } from 'vitest';
import { parseInputs } from './inputs';

/**
 * Fake `core.getInput` shaped closure. Consumers pass a map.
 */
const getInputFrom = (map: Record<string, string>) => (name: string) => map[name] ?? '';

describe('parseInputs', () => {
  describe('stack-name', () => {
    it('fails when missing', () => {
      const result = parseInputs(getInputFrom({}), {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('MissingRequiredInput');
        if (result.error.tag === 'MissingRequiredInput') {
          expect(result.error.name).toBe('stack-name');
        }
      }
    });

    it('fails when whitespace only', () => {
      const result = parseInputs(getInputFrom({ 'stack-name': '   ', region: 'us-east-1' }), {});
      expect(result.ok).toBe(false);
    });

    it('trims surrounding whitespace', () => {
      const result = parseInputs(
        getInputFrom({ 'stack-name': '  my-stack  ', region: 'us-east-1' }),
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.stackName).toBe('my-stack');
    });
  });

  describe('region', () => {
    it('uses explicit region input', () => {
      const result = parseInputs(getInputFrom({ 'stack-name': 's', region: 'ap-southeast-2' }), {});
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.region).toBe('ap-southeast-2');
    });

    it('falls back to AWS_REGION env', () => {
      const result = parseInputs(getInputFrom({ 'stack-name': 's' }), {
        AWS_REGION: 'eu-west-1',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.region).toBe('eu-west-1');
    });

    it('falls back to AWS_DEFAULT_REGION when AWS_REGION missing', () => {
      const result = parseInputs(getInputFrom({ 'stack-name': 's' }), {
        AWS_DEFAULT_REGION: 'us-west-2',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.region).toBe('us-west-2');
    });

    it('prefers explicit input over env', () => {
      const result = parseInputs(getInputFrom({ 'stack-name': 's', region: 'ap-southeast-2' }), {
        AWS_REGION: 'eu-west-1',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.region).toBe('ap-southeast-2');
    });

    it('fails when region absent from input and env', () => {
      const result = parseInputs(getInputFrom({ 'stack-name': 's' }), {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.tag).toBe('MissingRegion');
    });
  });

  describe('outputs', () => {
    it('defaults to empty array (fetch all)', () => {
      const result = parseInputs(getInputFrom({ 'stack-name': 's', region: 'r' }), {});
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.requestedOutputs).toEqual([]);
    });

    it('parses comma-separated list', () => {
      const result = parseInputs(
        getInputFrom({ 'stack-name': 's', region: 'r', outputs: 'A,B,C' }),
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.requestedOutputs).toEqual(['A', 'B', 'C']);
    });

    it('parses newline-separated list', () => {
      const result = parseInputs(
        getInputFrom({ 'stack-name': 's', region: 'r', outputs: 'A\nB\nC' }),
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.requestedOutputs).toEqual(['A', 'B', 'C']);
    });

    it('parses mixed comma and newline', () => {
      const result = parseInputs(
        getInputFrom({ 'stack-name': 's', region: 'r', outputs: 'A, B\nC,D' }),
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.requestedOutputs).toEqual(['A', 'B', 'C', 'D']);
    });

    it('trims and drops empty entries', () => {
      const result = parseInputs(
        getInputFrom({ 'stack-name': 's', region: 'r', outputs: ' A ,, B ,\n, C\n' }),
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.requestedOutputs).toEqual(['A', 'B', 'C']);
    });
  });

  describe('fail-on-missing', () => {
    it('defaults to true', () => {
      const result = parseInputs(getInputFrom({ 'stack-name': 's', region: 'r' }), {});
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.failOnMissing).toBe(true);
    });

    it.each(['true', 'TRUE', 'True'])('accepts truthy: %s', (v) => {
      const result = parseInputs(
        getInputFrom({ 'stack-name': 's', region: 'r', 'fail-on-missing': v }),
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.failOnMissing).toBe(true);
    });

    it.each(['false', 'FALSE', 'False'])('accepts falsy: %s', (v) => {
      const result = parseInputs(
        getInputFrom({ 'stack-name': 's', region: 'r', 'fail-on-missing': v }),
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.failOnMissing).toBe(false);
    });

    it('rejects garbage', () => {
      const result = parseInputs(
        getInputFrom({
          'stack-name': 's',
          region: 'r',
          'fail-on-missing': 'yes',
        }),
        {},
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('InvalidBoolean');
      }
    });
  });
});
