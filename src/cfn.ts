import {
  type CloudFormationClient,
  DescribeStacksCommand,
  type Output,
} from '@aws-sdk/client-cloudformation';
import { err, ok, type AppError, type Result } from './types';

const isStackNotFoundError = (error: unknown, stackName: string): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name !== 'ValidationError') return false;
  return (
    error.message.includes(stackName) && error.message.toLowerCase().includes('does not exist')
  );
};

const outputsToMap = (outputs: readonly Output[]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const entry of outputs) {
    if (entry.OutputKey !== undefined && entry.OutputValue !== undefined) {
      map.set(entry.OutputKey, entry.OutputValue);
    }
  }
  return map;
};

/**
 * Fetches a stack and returns its outputs as a Map preserving CFN order.
 *
 * Note: we don't use the AWS SDK's typed errors (e.g. StackNotFoundException)
 * because CloudFormation returns a generic ValidationError for missing stacks.
 * We pattern-match on name + message — ugly, but it's the API contract.
 */
export const fetchStackOutputs = async (
  client: CloudFormationClient,
  stackName: string,
): Promise<Result<Map<string, string>, AppError>> => {
  let response;
  try {
    response = await client.send(new DescribeStacksCommand({ StackName: stackName }));
  } catch (cause) {
    if (isStackNotFoundError(cause, stackName)) {
      return err({ tag: 'StackNotFound', stackName });
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ tag: 'AwsError', message, cause });
  }

  const stacks = response.Stacks ?? [];
  if (stacks.length === 0) {
    return err({ tag: 'StackNotFound', stackName });
  }

  const outputs = stacks[0]?.Outputs ?? [];
  if (outputs.length === 0) {
    return err({ tag: 'OutputsNotPresent', stackName });
  }

  const map = outputsToMap(outputs);
  if (map.size === 0) {
    return err({ tag: 'OutputsNotPresent', stackName });
  }

  return ok(map);
};
