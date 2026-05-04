/**
 * GitHub Actions core bindings we care about. Narrow interface helps test
 * without binding to @actions/core directly.
 */
export interface Core {
  setOutput(name: string, value: string): void;
  info(message: string): void;
}

/**
 * Emits:
 *  - one dynamic output per key (`core.setOutput(<key>, <value>)`)
 *  - a single aggregate `outputs` output as JSON
 */
export const emitOutputs = (core: Core, outputs: ReadonlyMap<string, string>): void => {
  const aggregate: Record<string, string> = {};
  for (const [key, value] of outputs) {
    core.setOutput(key, value);
    aggregate[key] = value;
    core.info(`Set output: ${key}`);
  }
  core.setOutput('outputs', JSON.stringify(aggregate));
};
