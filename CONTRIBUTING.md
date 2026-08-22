# Contributing & Git Workflow Guide

This document outlines the Git branching strategy, commit conventions, CI pipelines, and repository management practices used across the **LifeLine** codebase.

---

## 1. Branching Strategy

We follow a structured Git branching model to isolate development and maintain production stability:

```
master (production-ready releases deployed to Vercel & Render)
  ▲
  │ (Release PR / merge when CI passes)
develop (active integration branch)
  ▲
  ├── feature/intake-ai-parser
  ├── feature/redis-lock-concurrency
  ├── feature/prisma-postgres-audit
  └── fix/jwt-refresh-edge-case
```

- **`master`**: Production branch. Contains tested code deployed to Vercel (frontend) and Render (backend).
- **`develop`**: Primary integration branch. All feature branches branch off `develop` and merge back into `develop`.
- **`feature/<name>`**: Short-lived branches for new feature development (e.g. `feature/js-promises-and-eventloop`).
- **`fix/<name>`**: Targeted branches for bug fixes and edge-case remediation.

---

## 2. Commit Message Conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/) to maintain a clean, semantic commit history:

### Format
```
<type>(<scope>): <short description in imperative mood>
```

### Supported Types
- **`feat`**: A new feature (e.g., `feat: add postgresql prisma audit layer and react-router-dom client routing`)
- **`fix`**: A bug fix (e.g., `fix: guarantee /api/v1 prefix in client API base URL regardless of env format`)
- **`docs`**: Documentation changes only (e.g., `docs: add professional JSDoc and module-level comments across entire codebase`)
- **`style`**: Formatting, whitespace, or UI styling changes (e.g., `style: refine dark mode theme with sleek midnight colors`)
- **`refactor`**: Code restructuring without changing external behavior
- **`test`**: Adding or updating unit/integration tests (e.g., `test: add 20-client concurrent reservation test`)
- **`chore`**: Maintenance, CI workflows, or config updates (e.g., `chore: add PR/issue templates and CI workflow`)

---

## 3. Pull Request, Templates & CI Workflow

1. **Create Branch**: `git checkout develop && git checkout -b feature/<feature-name>`
2. **Implement & Test**: Run local test suites (`npm test` in `server/`) and verify the build (`npm run build` in `client/`).
3. **Commit**: Use atomic commits with conventional commit headers.
4. **Open Pull Request**: All pull requests automatically use the structured template in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).
5. **Continuous Integration (CI)**: Our GitHub Actions pipeline in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) triggers on every push and pull request targeting `develop` or `master`. It executes:
   - `test-server`: Installs dependencies and runs full Jest unit and integration suites in `server/`.
   - `build-client`: Validates TypeScript compilation and builds Vite assets in `client/`.
6. **Merge**: Merging into `develop` or `master` is only allowed after all CI jobs succeed.

---

## 4. Branch Protection Rules

To prevent accidental outages in production, we configure GitHub branch protection on the `master` and `develop` branches:

### Intended Rules
- **Require a pull request before merging**: Disallow direct pushes to `master`.
- **Require status checks to pass before merging**: The GitHub Actions `CI Pipeline` (`test-server` and `build-client`) must succeed.
- **Require conversation resolution**: All review comments must be resolved before merging.

### Steps to Enable in GitHub Repository Settings
1. Navigate to your repository on GitHub: `https://github.com/MayankSharma-2812/Lifeline`
2. Click **Settings** (top navigation tab) → **Branches** (in the left sidebar under "Code and automation").
3. Under **Branch protection rules**, click **Add branch ruleset** or **Add rule**.
4. Set **Branch name pattern** to `master` (and repeat for `develop`).
5. Check **Require a pull request before merging**.
6. Check **Require status checks to pass before merging** and search for `test-server` and `build-client`.
7. Click **Create** or **Save changes**.
