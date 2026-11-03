# Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) gives every pull request
automated build and correctness feedback. It runs for each pull request and for each
push to `main`, and a newer push to the same pull request cancels the run that is
still in progress.

## Jobs and required checks

These are the two checks to require before merging in the repository's branch
protection settings. Their names are exactly the job names below.

| Check name | What it runs |
| --- | --- |
| `Lint, types, unit tests, build` | `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| `Database integration and browser tests` | `npm run test:integration`, then Chromium smoke tests with `npm run test:e2e` |

Both jobs run on Node.js 24 and install with `npm ci`, which uses exactly the versions
in `package-lock.json` and fails when the lockfile and `package.json` disagree. Run the
same commands locally with `npm run check`, `npm run test:integration`, and
`npm run test:e2e`.

## Database tests and secrets

The second job starts a throwaway PostgreSQL 18 service container that exists only
for that job. It listens on the one target the test runner accepts: user and database
`bgmatura_test` on loopback port `55433`. The container uses trust authentication on
the runner, so **no password, token, or repository secret is used or stored**.
`TEST_DATABASE_URL` points at that container, and the runner's guard still refuses any
other target before a migration or query runs. Production and development database URLs
are never configured in CI.

Other protections in the workflow:

- The token is read-only (`permissions: contents: read`) and checkout does not persist
  its credentials.
- The workflow uses `pull_request`, never `pull_request_target`, so code from a fork
  runs without access to secrets, and none are needed.
- Actions are pinned to commit SHAs, with the release version in a comment. Update a pin
  deliberately and review the release when you do.
- If a browser test fails, its traces are kept for seven days as the `playwright-traces`
  artifact. Review a trace before sharing it outside the team, since it can contain page
  content.

## When a check fails

Reproduce locally with the matching command from the table above. Integration and
browser tests need the local test database described in
[DATABASE.md](DATABASE.md). A failing `npm ci` usually means `package-lock.json` was not
updated with `package.json`.

## Changing the workflow

Keep the commands here aligned with the `package.json` scripts, keep the job names
unchanged unless the required-check settings are updated at the same time, and avoid
adding secrets. Anything that needs a secret, such as a deployment, belongs in a
separate workflow with its own review.
