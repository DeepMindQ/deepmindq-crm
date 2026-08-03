# Contributing to DeepMindQ

Thank you for your interest in contributing to DeepMindQ. This guide outlines the standards and processes all contributors must follow.

## Branch Strategy

- **`main` is protected.** Direct commits to `main` are not permitted. All changes must go through pull requests.
- **Feature branches** follow the naming convention `feature/wi-{n}`, where `{n}` corresponds to the work item number (e.g., `feature/wi-14`).
- **Bugfix branches** follow `fix/wi-{n}`.
- Always branch off the latest `main`. Rebase before opening a PR if `main` has advanced.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) with a mandatory work-item reference.

### Format

```
<type>(<scope>): <description> [WI-{n}]
```

### Types

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks, tooling, dependencies |
| `security` | Security-related changes |

### Examples

```
feat(ai): add streaming response support [WI-14]
fix(auth): resolve OTP expiration race condition [WI-12]
security(middleware): tighten CSRF token validation [WI-15]
docs: update API authentication guide [WI-10]
```

## Pull Request Process

### PR Description Template

Every PR must include:

```markdown
## Summary
Brief description of what this PR does and why.

## Work Item
Links to WI-{n}

## Changes
- Bullet list of changes

## Testing
- What tests were added/updated
- How to manually verify

## Checklist
- [ ] All tests pass
- [ ] No `any` without justification
- [ ] LLM calls go through `governedAI()`
- [ ] No secrets committed
- [ ] CI is green
```

### Requirements

1. **Link to WI item** — every PR must reference the work item it fulfills.
2. **Testing requirements** — all existing tests must pass; new features must include corresponding tests.
3. **CI must be green** — the CI pipeline (TypeScript check, ESLint, tests) must pass before merge.
4. **Description required** — PRs without a description using the template above will be blocked.

## Testing

- **All tests must pass** before a PR can be merged. Run `npm run test` locally before pushing.
- **New features require tests.** If a feature adds business logic, server-side validation, or API endpoints, corresponding unit/integration tests are mandatory.
- **Test failures block merges.** There are no exceptions.

## Code Review Standards

Reviewers will evaluate PRs against the following standards:

- **TypeScript strict mode** — the project uses `strict: true` in `tsconfig.json`. All code must satisfy strict type checking.
- **No `any` without justification** — use of the `any` type is prohibited unless accompanied by an inline comment explaining why a more specific type cannot be used and what the mitigation is.
- **All LLM calls through `governedAI()`** — every call to an external LLM provider must go through the `governedAI()` wrapper in `src/lib/ai-governance.ts`. Direct LLM API calls are not permitted.

## Security

DeepMindQ handles sensitive data. The following security rules are non-negotiable:

1. **Never commit secrets.** API keys, database credentials, encryption keys, and tokens must never appear in source code. Use environment variables exclusively.
2. **Never hardcode fallbacks for secrets.** There must be no default or fallback values for secret environment variables. If a secret is missing, the application must fail to start (enforced by `validate-env.ts`).
3. **Never skip auth guards.** Authentication and authorization middleware must not be bypassed or disabled, even temporarily. If a route requires authentication, the guard stays.

Violations of security rules will result in the PR being rejected and may require a security review.

## Questions?

Open a discussion or reach out to the maintainers. We appreciate your contribution!
