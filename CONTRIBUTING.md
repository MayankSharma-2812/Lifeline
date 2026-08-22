# Contributing & Git Workflow Guide

This document outlines the Git branching strategy, commit conventions, and development practices used across the **LifeLine** codebase.

---

## 1. Branching Strategy

We follow a structured Git branching model to isolate development and maintain production stability:

```
master (production-ready releases)
  ▲
  │ (Release PR / merge)
develop (active integration branch)
  ▲
  ├── feature/intake-ai-parser
  ├── feature/redis-lock-concurrency
  ├── feature/prisma-postgres-audit
  └── fix/jwt-refresh-edge-case
```

- **`master`**: Production branch. Contains tested code deployed to Vercel (frontend) and Render (backend).
- **`develop`**: Primary integration branch. All feature branches branch off `develop` and merge back into `develop`.
- **`feature/<name>`**: Short-lived branches for new feature development (e.g. `feature/js-core-and-git-workflow`).
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
- **`chore`**: Dependency updates, build configs, or maintenance tasks

---

## 3. Pull Request & Verification Workflow

1. **Create Branch**: `git checkout develop && git checkout -b feature/<feature-name>`
2. **Implement & Test**: Run local test suites (`npm test` in `server/`) and linting (`npm run build` in `client/`).
3. **Commit**: Use atomic commits with conventional commit headers.
4. **Merge**: Merge back into `develop` via fast-forward or squash merge.
