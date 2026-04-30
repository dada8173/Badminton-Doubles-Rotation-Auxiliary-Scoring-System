---
name: git-commit
description: "Use when creating or updating git commits, choosing Conventional Commit messages, staging changes, or checking commit safety."
---

# Git Commit

Create standardized git commits using Conventional Commits. Analyze the actual diff before choosing the commit type, scope, and message.

## When to Use

Use this skill when the user wants to:

- Create a git commit.
- Write or refine a Conventional Commit message.
- Stage changes in a logical group before committing.
- Check whether a commit is safe or appropriate.

## Workflow

1. Inspect the repository state.
2. Analyze the staged diff first; if nothing is staged, analyze the working tree diff.
3. Determine the smallest logical change set.
4. Stage files only when needed to keep the commit focused.
5. Choose the Conventional Commit type, optional scope, and concise description.
6. Add a body or footer only when they add value.
7. Run the commit only after the message matches the change.

## Diff Analysis

Base the message on the actual changes, not on assumptions.

- `feat`: new user-facing capability.
- `fix`: bug fix.
- `docs`: documentation-only change.
- `style`: formatting or style-only change with no logic impact.
- `refactor`: code restructuring without feature or bug fix intent.
- `perf`: performance improvement.
- `test`: added or updated tests.
- `build`: build system or dependency changes.
- `ci`: CI or automation changes.
- `chore`: maintenance or misc changes.
- `revert`: revert a previous commit.

Use a scope when it clarifies the affected area, such as `ui`, `api`, `auth`, or a module name.

## Commit Format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

Keep the description in present tense and imperative mood. Prefer under 72 characters.

## Breaking Changes

Use one of these when the change is breaking:

```text
feat!: remove deprecated endpoint
```

```text
feat: change config format

BREAKING CHANGE: config keys now use nested objects
```

## Staging Guidance

- Stage only the files that belong in the same logical commit.
- Use interactive staging or pattern-based staging when the change set is mixed.
- Do not include generated artifacts unless they are intentionally part of the change.
- Never commit secrets, credentials, private keys, or `.env` files.

## Safety Rules

- Never update git config unless the user explicitly asks.
- Never use destructive commands such as hard reset or force operations without explicit request.
- Never skip hooks with `--no-verify` unless the user explicitly asks.
- Never force-push to main or master.
- If a commit fails because of hooks, fix the issue and create a new commit instead of amending unless the user asks otherwise.

## Completion Check

A commit is ready when:

- The diff matches the commit message.
- The staged set is logically coherent.
- Sensitive files are excluded.
- The message follows Conventional Commits.
- The change is safe to commit.
