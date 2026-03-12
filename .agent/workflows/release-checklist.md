---
description: Pre-release checklist for pushing changes to GitHub
---

# Release Checklist

Before pushing any changes to GitHub, ensure ALL items in this checklist are completed and verified. This checklist is mandatory for every release, no matter how small the change.

---

## 1. Environment Variables

- [ ] Review all environment variables in `.env.local`
- [ ] Verify Vercel environment variables match local configuration
- [ ] Confirm no sensitive values are hardcoded in the codebase
- [ ] Check that any new environment variables are documented

**Verification command:**
```bash
# List local env vars (without values for security)
grep -E "^[A-Z_]+=" .env.local | cut -d'=' -f1 | sort
```

---

## 2. Regression Test Suite

- [ ] Run the complete Playwright regression test suite
- [ ] All tests pass (no failures or skipped tests without documentation)
- [ ] Review any flaky tests and address root causes

**Verification commands:**
```bash
# Run full test suite
npm run test:e2e

# View test report for detailed results
npm run test:e2e:report
```

---

## 3. New Feature Test Coverage

- [ ] New test cases are written for any added functionality
- [ ] Test cases cover both happy path and edge cases
- [ ] Tests are properly documented with clear descriptions
- [ ] New tests are integrated into the test suite and passing

**Review locations:**
- `tests/homepage.spec.ts` - Homepage tests
- `tests/navigation.spec.ts` - Navigation tests
- `tests/pages.spec.ts` - Page loading tests
- `tests/accessibility.spec.ts` - Accessibility tests

---

## 4. Defect Logging

- [ ] All found defects during testing are logged
- [ ] Defects include clear reproduction steps
- [ ] Defects are categorized by severity (Critical/High/Medium/Low)
- [ ] Screenshots or recordings are attached where applicable

**Defect template:**
```markdown
### Defect Title
- **Severity:** [Critical/High/Medium/Low]
- **Found in:** [Page/Component]
- **Steps to Reproduce:**
  1. Step one
  2. Step two
- **Expected Result:** What should happen
- **Actual Result:** What actually happens
- **Screenshots:** [Attach if applicable]
```

---

## 5. Defect Resolution & Manual Verification

- [ ] All Critical and High severity defects are resolved
- [ ] Fixes have been verified by a human (not just automated tests)
- [ ] Manual testing confirms the fix works as expected
- [ ] Regression testing confirms no new issues were introduced
- [ ] Medium/Low defects are either resolved or documented for future sprints

---

## 6. Final Pre-Push Checklist

- [ ] Code has been reviewed (self-review or peer review)
- [ ] Build completes successfully: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] All console errors and warnings addressed
- [ ] Commit messages are clear and descriptive
- [ ] Branch is up to date with main/master

**Final verification:**
```bash
# Build check
npm run build

# Lint check
npm run lint

# Final test run
npm run test:e2e
```

---

## Sign-Off

| Item | Completed | Verified By | Date |
|------|-----------|-------------|------|
| Environment Variables | [ ] | | |
| Regression Tests | [ ] | | |
| New Test Cases | [ ] | | |
| Defects Logged | [ ] | | |
| Defects Resolved | [ ] | | |
| Final Checks | [ ] | | |

**Release Approved By:** ___________________

**Date:** ___________________

---

> **Note:** Do not proceed with the push to GitHub until ALL items are checked and signed off. This checklist exists to maintain quality and prevent production issues.
