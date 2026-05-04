import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from './main';

const cfnMock = mockClient(CloudFormationClient);

const makeCore = (inputs: Record<string, string>) => {
  const outputs: Record<string, string> = {};
  const errors: string[] = [];
  const infos: string[] = [];
  return {
    outputs,
    errors,
    infos,
    core: {
      getInput: (name: string) => inputs[name] ?? '',
      setOutput: (name: string, value: string) => {
        outputs[name] = value;
      },
      setFailed: (message: string) => {
        errors.push(message);
      },
      info: (message: string) => {
        infos.push(message);
      },
    },
  };
};

describe('run (integration)', () => {
  beforeEach(() => {
    cfnMock.reset();
  });

  it('fetches all outputs and emits them individually + as JSON', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({
      Stacks: [
        {
          StackName: 'my-stack',
          CreationTime: new Date(),
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [
            { OutputKey: 'ApiUrl', OutputValue: 'https://api.example.com' },
            { OutputKey: 'BucketName', OutputValue: 'my-bucket' },
          ],
        },
      ],
    });

    const { core, outputs, errors } = makeCore({
      'stack-name': 'my-stack',
      region: 'us-east-1',
    });

    await run(core, {});

    expect(errors).toEqual([]);
    expect(outputs['ApiUrl']).toBe('https://api.example.com');
    expect(outputs['BucketName']).toBe('my-bucket');
    expect(JSON.parse(outputs['outputs']!)).toEqual({
      ApiUrl: 'https://api.example.com',
      BucketName: 'my-bucket',
    });
  });

  it('fails the action when required input missing', async () => {
    const { core, errors } = makeCore({});
    await run(core, {});
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('stack-name');
  });

  it('fails the action when region cannot be resolved', async () => {
    const { core, errors } = makeCore({ 'stack-name': 's' });
    await run(core, {});
    expect(errors.length).toBe(1);
    expect(errors[0]!.toLowerCase()).toContain('region');
  });

  it('fails the action when stack not found', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({ Stacks: [] });
    const { core, errors } = makeCore({
      'stack-name': 'ghost',
      region: 'us-east-1',
    });
    await run(core, {});
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('ghost');
  });

  it('fails when requested output missing and fail-on-missing=true', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({
      Stacks: [
        {
          StackName: 'my-stack',
          CreationTime: new Date(),
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [{ OutputKey: 'ApiUrl', OutputValue: 'x' }],
        },
      ],
    });
    const { core, errors } = makeCore({
      'stack-name': 'my-stack',
      region: 'us-east-1',
      outputs: 'ApiUrl,Missing',
    });
    await run(core, {});
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Missing');
  });

  it('skips missing outputs when fail-on-missing=false', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({
      Stacks: [
        {
          StackName: 'my-stack',
          CreationTime: new Date(),
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [{ OutputKey: 'ApiUrl', OutputValue: 'x' }],
        },
      ],
    });
    const { core, outputs, errors } = makeCore({
      'stack-name': 'my-stack',
      region: 'us-east-1',
      outputs: 'ApiUrl,Missing',
      'fail-on-missing': 'false',
    });
    await run(core, {});
    expect(errors).toEqual([]);
    expect(outputs['ApiUrl']).toBe('x');
    expect(outputs['Missing']).toBeUndefined();
  });

  it('uses AWS_REGION env when region input absent', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({
      Stacks: [
        {
          StackName: 's',
          CreationTime: new Date(),
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [{ OutputKey: 'Key', OutputValue: 'v' }],
        },
      ],
    });
    const { core, errors } = makeCore({ 'stack-name': 's' });
    await run(core, { AWS_REGION: 'ap-southeast-2' });
    expect(errors).toEqual([]);
  });

  it('catches unexpected exceptions and surfaces them via setFailed', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { core, errors } = makeCore({
      'stack-name': 'my-stack',
      region: 'us-east-1',
    });

    // Force an unexpected error by making setOutput throw
    const throwingCore = {
      ...core,
      setOutput: () => {
        throw new Error('boom');
      },
    };
    cfnMock.on(DescribeStacksCommand).resolves({
      Stacks: [
        {
          StackName: 'my-stack',
          CreationTime: new Date(),
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [{ OutputKey: 'K', OutputValue: 'v' }],
        },
      ],
    });
    await run(throwingCore, {});
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('boom');
    spy.mockRestore();
  });
});
