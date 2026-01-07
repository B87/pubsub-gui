# Commit Command

This command helps commit code changes by categorizing them into conventional commit types (feat/fix/chore) and creating appropriate commit messages.

## Process

1. **Analyze Changes**: Review the git diff to categorize changes
2. **Categorize Changes**: Split changes into feat/fix/chore based on:
   - `feat`: New features, new functionality, new components
   - `fix`: Bug fixes, error corrections, bug-related changes
   - `chore`: Dependencies, config files, build scripts, refactoring without behavior change
3. **Stage Changes**: Run `git add .` to stage all changes
4. **Create Commit Messages**: Generate appropriate commit messages for each category

## Categorization Rules

### `feat` (Features)
- New components or UI elements
- New functionality or capabilities
- New API methods or endpoints
- New user-facing features
- New configuration options
- New templates or template features

### `fix` (Bug Fixes)
- Bug fixes and error corrections
- Fixing broken functionality
- Error handling improvements
- Race condition fixes
- Memory leak fixes
- Type errors or TypeScript fixes

### `chore` (Maintenance)
- Dependency updates (package.json, go.mod)
- Configuration file changes (tsconfig.json, vite.config.ts, tailwind.config.js)
- Build script changes
- Code formatting or style changes
- Refactoring without behavior change
- Documentation updates
- Test file updates
- CI/CD changes

## Execution Steps

1. **Get git diff**:
   ```bash
   git diff --cached  # For staged changes
   git diff           # For unstaged changes
   ```

2. **Analyze and categorize** each changed file:
   - Review file paths and changes
   - Determine primary category (feat/fix/chore)
   - If multiple categories, use the most significant one

3. **Stage all changes**:
   ```bash
   git add .
   ```

4. **Create commit message**:
   - Use conventional commit format: `type(scope): description`
   - Scope is optional but helpful (e.g., `feat(ui)`, `fix(monitoring)`, `chore(deps)`)
   - Description should be clear and concise
   - Use present tense ("add" not "added")
   - First line should be 50 characters or less
   - Add body if needed (separated by blank line)

5. **Commit**:
   ```bash
   git commit -m "type(scope): description"
   ```

## Examples

### Feature Commit
```
feat(ui): add shadcn/ui component library integration

- Add shadcn/ui components (Button, Dialog, Input, Select, etc.)
- Create wrapper components for theme support
- Add path aliases (@/components, @/lib/utils)
- Update components to use new UI primitives
```

### Fix Commit
```
fix(auth): prevent blocking on gRPC client close

- Add timeout to client.Close() operations
- Close clients in goroutines to prevent blocking
- Handle stuck gRPC connections gracefully
```

### Chore Commit
```
chore(deps): update dependencies and add shadcn/ui

- Update go-version to v1.8.0
- Update enterprise-certificate-proxy to v0.3.8
- Add shadcn/ui components via npx
- Add clsx and tailwind-merge utilities
```

## Multiple Categories

If changes span multiple categories, create separate commits:

1. **First commit**: Most significant category
2. **Subsequent commits**: Other categories

Example:
```bash
git add frontend/src/components/
git commit -m "feat(ui): add shadcn/ui component library"

git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): add shadcn/ui dependencies"

git add go.mod go.sum
git commit -m "chore(deps): update Go dependencies"
```

## Important Notes

- **Always review the diff** before committing
- **Group related changes** together in the same commit
- **Keep commits focused** - one logical change per commit
- **Use descriptive messages** that explain what and why
- **Don't commit** if there are linter errors or test failures
- **Check for sensitive data** before committing (API keys, tokens, etc.)
