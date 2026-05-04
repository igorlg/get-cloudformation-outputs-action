import { err, ok, type AppError, type Result } from './types';

/**
 * Picks a subset of outputs from the stack's output map.
 *
 * - `requested` empty  -> return everything (preserving CFN order).
 * - `requested` non-empty + all present -> return those keys, in request order.
 * - `requested` non-empty + some missing + `failOnMissing=true`  -> error.
 * - `requested` non-empty + some missing + `failOnMissing=false` -> skip missing.
 */
export const selectOutputs = (
  all: ReadonlyMap<string, string>,
  requested: readonly string[],
  failOnMissing: boolean,
): Result<Map<string, string>, AppError> => {
  if (requested.length === 0) {
    return ok(new Map(all));
  }

  const selected = new Map<string, string>();
  const missing: string[] = [];

  for (const name of requested) {
    const value = all.get(name);
    if (value === undefined) {
      missing.push(name);
    } else {
      selected.set(name, value);
    }
  }

  if (missing.length > 0 && failOnMissing) {
    return err({ tag: 'RequestedOutputsMissing', names: missing });
  }

  return ok(selected);
};
