# Testing & Pre-commit Hooks

## Overview

This project uses **automated testing** to ensure shared components don't break when making changes. Tests run automatically before every commit via git hooks.

## 🧪 Running Tests

### Test Individual Packages

```bash
# Test schema-components package
cd packages/schema-components
npm test

# Test with UI (interactive)
npm run test:ui

# Test with coverage report
npm run test:coverage
```

### Test All Shared Packages

```bash
# From root - tests all shared components
npm run test:shared

# Test everything (including apps that have tests)
npm run test:all
```

## 🔒 Pre-commit Hook

A **pre-commit hook** automatically runs tests on shared packages before allowing commits.

### How It Works

When you run `git commit`:
1. 🧪 Tests run automatically on all shared packages
2. ✅ If tests pass → Commit proceeds
3. ❌ If tests fail → Commit is blocked

### Example

```bash
git add packages/schema-components/src/SchemaViewer.jsx
git commit -m "Update SchemaViewer"

# Output:
# 🧪 Running tests on shared components...
# ✓ src/SchemaViewer.test.jsx  (22 tests) 189ms
# ✅ All tests passed!
# [main abc123] Update SchemaViewer
```

### If Tests Fail

```bash
git commit -m "Break something"

# Output:
# 🧪 Running tests on shared components...
# ✗ src/SchemaViewer.test.jsx  (2 failed | 20 passed)
# ❌ Tests failed! Fix them before committing.
# 
# Fix the tests or code, then commit again
```

### Bypassing the Hook (Emergency Only!)

If you absolutely need to commit without tests (NOT recommended):

```bash
git commit --no-verify -m "Emergency fix"
```

⚠️ **Warning:** Only use `--no-verify` in emergencies. Breaking tests mean breaking both apps!

## 📦 Shared Packages with Tests

Currently tested packages:
- `@bdsa/schema-components` - 22 tests
  - SchemaViewer rendering
  - Schema section extraction
  - File loading & error handling
  - Abbreviations & landmarks support

## 🎯 Best Practices

1. **Write tests when adding features** - Future you will thank you!
2. **Run tests locally** before committing (saves time)
3. **Don't skip the hook** - It's there to protect both apps
4. **Fix failing tests immediately** - Don't let them accumulate

## 🔧 Troubleshooting

### Hook Not Running

```bash
# Reinstall husky
npm run prepare
```

### Tests Taking Too Long

The hook only tests shared packages (fast), not the full apps. Schema-components tests run in ~200ms.

### Want to Test Before Committing

```bash
# Quick test run
npm run test:shared
```

## 📚 Adding Tests to New Packages

When creating a new shared package:

1. Add test script to `package.json`:
```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

2. Create test files (e.g., `MyComponent.test.jsx`)

3. Tests will automatically run on commit! 🎉

---

**Remember:** Tests are your safety net. They catch bugs before they reach production! 🛡️

