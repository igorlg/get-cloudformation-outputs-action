/**
 * Minimal Rust-style Result type. Explicit error paths, no thrown exceptions
 * inside the core logic — errors bubble up as values until the entry point.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Parsed & validated action inputs.
 */
export interface Inputs {
  readonly stackName: string;
  readonly region: string;
  readonly requestedOutputs: readonly string[]; // empty = fetch all
  readonly failOnMissing: boolean;
}

/**
 * Tagged union of all domain errors. Each variant carries enough info to
 * render a useful failure message at the boundary.
 */
export type AppError =
  | { readonly tag: 'MissingRequiredInput'; readonly name: string }
  | { readonly tag: 'MissingRegion' }
  | { readonly tag: 'InvalidBoolean'; readonly name: string; readonly value: string }
  | { readonly tag: 'StackNotFound'; readonly stackName: string }
  | { readonly tag: 'OutputsNotPresent'; readonly stackName: string }
  | { readonly tag: 'RequestedOutputsMissing'; readonly names: readonly string[] }
  | { readonly tag: 'AwsError'; readonly message: string; readonly cause: unknown };

export const formatError = (error: AppError): string => {
  switch (error.tag) {
    case 'MissingRequiredInput':
      return `Required input '${error.name}' is missing.`;
    case 'MissingRegion':
      return `No AWS region provided. Set the 'region' input or AWS_REGION/AWS_DEFAULT_REGION env var.`;
    case 'InvalidBoolean':
      return `Input '${error.name}' must be 'true' or 'false', got '${error.value}'.`;
    case 'StackNotFound':
      return `CloudFormation stack '${error.stackName}' was not found.`;
    case 'OutputsNotPresent':
      return `CloudFormation stack '${error.stackName}' has no outputs.`;
    case 'RequestedOutputsMissing':
      return `Requested output(s) not found on stack: ${error.names.join(', ')}.`;
    case 'AwsError':
      return `AWS API error: ${error.message}`;
  }
};
