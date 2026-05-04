import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { fetchStackOutputs } from './cfn';
import { emitOutputs, type Core } from './emit';
import { parseInputs } from './inputs';
import { selectOutputs } from './select';
import { formatError } from './types';

/**
 * Full action entrypoint. Takes a core-like object and the process env,
 * returns nothing — side-effects are: calling `setOutput` for each output
 * and `setFailed` on error.
 *
 * Split out from `index.ts` so we can unit-test the full wiring without
 * depending on @actions/core's real implementation.
 */
export interface ActionCore extends Core {
  getInput(name: string): string;
  setFailed(message: string): void;
}

export const run = async (
  core: ActionCore,
  env: Partial<Record<string, string>>,
): Promise<void> => {
  try {
    const inputsResult = parseInputs((name) => core.getInput(name), env);
    if (!inputsResult.ok) {
      core.setFailed(formatError(inputsResult.error));
      return;
    }
    const inputs = inputsResult.value;

    core.info(`Fetching outputs from stack '${inputs.stackName}' in ${inputs.region}`);

    const client = new CloudFormationClient({ region: inputs.region });
    const fetchResult = await fetchStackOutputs(client, inputs.stackName);
    if (!fetchResult.ok) {
      core.setFailed(formatError(fetchResult.error));
      return;
    }

    const selectResult = selectOutputs(
      fetchResult.value,
      inputs.requestedOutputs,
      inputs.failOnMissing,
    );
    if (!selectResult.ok) {
      core.setFailed(formatError(selectResult.error));
      return;
    }

    emitOutputs(core, selectResult.value);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    core.setFailed(`Unexpected error: ${message}`);
  }
};
