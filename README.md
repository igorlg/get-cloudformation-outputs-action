# get-cloudformation-outputs-action

A GitHub Action that fetches outputs from an AWS CloudFormation stack and
exposes them as step outputs.

- Fetches all outputs by default, or a specific subset you name.
- Exposes each output individually (`${{ steps.x.outputs.ApiUrl }}`) **and**
  as a single JSON-encoded aggregate (`${{ steps.x.outputs.outputs }}`).
- Uses the AWS SDK v3 default credential chain — pair it with
  [`aws-actions/configure-aws-credentials`](https://github.com/aws-actions/configure-aws-credentials)
  (OIDC recommended).

## Usage

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GithubActionsRole
          aws-region: ap-southeast-2

      - id: cfn
        uses: igorlg/get-cloudformation-outputs-action@v1
        with:
          stack-name: my-app-prod
          # Optional: only fetch specific outputs (comma or newline separated)
          outputs: |
            ApiUrl
            BucketName

      - name: Use a single output
        run: echo "API lives at ${{ steps.cfn.outputs.ApiUrl }}"

      - name: Use the aggregate JSON
        run: echo '${{ steps.cfn.outputs.outputs }}' | jq .
```

## Inputs

| Name              | Required | Default | Description                                                                                          |
| ----------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `stack-name`      | yes      | —       | Name or ARN of the CloudFormation stack.                                                             |
| `region`          | no       | —       | AWS region. Falls back to `AWS_REGION` → `AWS_DEFAULT_REGION` from env.                              |
| `outputs`         | no       | _(all)_ | Comma- or newline-separated list of output keys to fetch. Empty = all. Case-sensitive.               |
| `fail-on-missing` | no       | `true`  | If `true`, the action fails when a requested output is absent. If `false`, missing keys are skipped. |

## Outputs

| Name      | Description                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `outputs` | JSON string — object mapping every fetched output key to its value, e.g. `{"ApiUrl":"https://...","BucketName":"my-bucket"}`. |
| _dynamic_ | Each fetched output key is also emitted as its own step output, so you can reference `steps.<id>.outputs.<Key>`.              |

## Auth

The action itself does not accept credential inputs. It uses the default
AWS SDK credential resolution chain — environment variables, profile,
OIDC-assumed role, etc. Configure credentials with a previous step:

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::<account>:role/<role>
    aws-region: <region>
```

## Failure modes

The action calls `setFailed` with a clear message when:

- `stack-name` is missing or empty
- Region can't be resolved from input or env
- `fail-on-missing` is neither `true` nor `false`
- Stack doesn't exist
- Stack has no outputs at all
- Any requested output isn't on the stack (when `fail-on-missing=true`)
- Any other AWS API error occurs

## Development

```bash
npm install        # install deps
npm test           # run the test suite
npm run typecheck  # strict TS check
npm run build      # produce dist/index.js
npm run all        # everything (format, typecheck, test, build)
```

`dist/` is committed to the repo — GitHub runs the action directly from the
bundled output, without installing dependencies on the runner. CI verifies
`dist/` is in sync with source on every PR.

## License

MIT
