import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { fetchStackOutputs } from './cfn';

const cfnMock = mockClient(CloudFormationClient);

describe('fetchStackOutputs', () => {
  beforeEach(() => {
    cfnMock.reset();
  });

  it('returns map of outputs for a stack with outputs', async () => {
    cfnMock.on(DescribeStacksCommand, { StackName: 'my-stack' }).resolves({
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

    const client = new CloudFormationClient({ region: 'us-east-1' });
    const result = await fetchStackOutputs(client, 'my-stack');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.fromEntries(result.value)).toEqual({
        ApiUrl: 'https://api.example.com',
        BucketName: 'my-bucket',
      });
    }
  });

  it('returns StackNotFound when describe returns empty Stacks', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({ Stacks: [] });

    const client = new CloudFormationClient({ region: 'us-east-1' });
    const result = await fetchStackOutputs(client, 'ghost');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('StackNotFound');
    }
  });

  it('returns StackNotFound when AWS throws ValidationError for missing stack', async () => {
    const awsError = new Error('Stack with id ghost does not exist');
    awsError.name = 'ValidationError';
    cfnMock.on(DescribeStacksCommand).rejects(awsError);

    const client = new CloudFormationClient({ region: 'us-east-1' });
    const result = await fetchStackOutputs(client, 'ghost');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('StackNotFound');
    }
  });

  it('returns OutputsNotPresent when stack has no outputs', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({
      Stacks: [
        {
          StackName: 'no-outputs',
          CreationTime: new Date(),
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [],
        },
      ],
    });

    const client = new CloudFormationClient({ region: 'us-east-1' });
    const result = await fetchStackOutputs(client, 'no-outputs');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('OutputsNotPresent');
    }
  });

  it('returns OutputsNotPresent when Outputs field is undefined', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({
      Stacks: [
        {
          StackName: 'no-outputs',
          CreationTime: new Date(),
          StackStatus: 'CREATE_COMPLETE',
        },
      ],
    });

    const client = new CloudFormationClient({ region: 'us-east-1' });
    const result = await fetchStackOutputs(client, 'no-outputs');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('OutputsNotPresent');
    }
  });

  it('wraps unknown AWS errors as AwsError', async () => {
    const awsError = new Error('Throttled');
    awsError.name = 'ThrottlingException';
    cfnMock.on(DescribeStacksCommand).rejects(awsError);

    const client = new CloudFormationClient({ region: 'us-east-1' });
    const result = await fetchStackOutputs(client, 'my-stack');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('AwsError');
      if (result.error.tag === 'AwsError') {
        expect(result.error.message).toContain('Throttled');
      }
    }
  });

  it('skips output entries missing key or value', async () => {
    cfnMock.on(DescribeStacksCommand).resolves({
      Stacks: [
        {
          StackName: 'partial',
          CreationTime: new Date(),
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [
            { OutputKey: 'Good', OutputValue: 'yes' },
            { OutputKey: 'NoValue' },
            { OutputValue: 'orphan' },
          ],
        },
      ],
    });

    const client = new CloudFormationClient({ region: 'us-east-1' });
    const result = await fetchStackOutputs(client, 'partial');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.fromEntries(result.value)).toEqual({ Good: 'yes' });
    }
  });
});
