import { err, ok, type AppError, type Inputs, type Result } from './types';

type GetInput = (name: string) => string;
type Env = Partial<Record<string, string>>;

/**
 * Splits a string on commas OR newlines, trims, drops empties.
 */
const parseList = (raw: string): readonly string[] =>
  raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const parseBoolean = (
  name: string,
  raw: string,
  defaultValue: boolean,
): Result<boolean, AppError> => {
  if (raw === '') return ok(defaultValue);
  const lower = raw.toLowerCase();
  if (lower === 'true') return ok(true);
  if (lower === 'false') return ok(false);
  return err({ tag: 'InvalidBoolean', name, value: raw });
};

const resolveRegion = (explicit: string, env: Env): Result<string, AppError> => {
  const candidate =
    explicit.trim() || env.AWS_REGION?.trim() || env.AWS_DEFAULT_REGION?.trim() || '';
  if (candidate === '') return err({ tag: 'MissingRegion' });
  return ok(candidate);
};

export const parseInputs = (getInput: GetInput, env: Env): Result<Inputs, AppError> => {
  const stackName = getInput('stack-name').trim();
  if (stackName === '') {
    return err({ tag: 'MissingRequiredInput', name: 'stack-name' });
  }

  const regionResult = resolveRegion(getInput('region'), env);
  if (!regionResult.ok) return regionResult;

  const failOnMissingResult = parseBoolean('fail-on-missing', getInput('fail-on-missing'), true);
  if (!failOnMissingResult.ok) return failOnMissingResult;

  const requestedOutputs = parseList(getInput('outputs'));

  return ok({
    stackName,
    region: regionResult.value,
    requestedOutputs,
    failOnMissing: failOnMissingResult.value,
  });
};
