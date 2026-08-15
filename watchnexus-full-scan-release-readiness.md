# WatchNexus — Full Software Scan (Release Readiness) — Updated

Repo: `Z3r0Fell/WatchNexus-Master` · Clean clone, HEAD `ba879f1c` · Rescanned: 2026-07-23
Updates the previous full-scan report. Everything below was re-verified against a fresh clone, not carried over blind.

## ✅ Confirmed Fixed Since Last Scan

- [x] **`yarn.lock` sync committed** (`ba879f1c fix: sync yarn.lock with package.json`) — `yarn install --frozen-lockfile` now succeeds locally against the committed file.
- [x] **`PR Build Check` now actually runs on push to `main`**, not just on PRs — the workflow's own header comment confirms this was updated for the direct-to-main workflow. This closes the "hasn't run in 7 weeks" gap from the first report.
- [x] **Security Scan's frontend audit now has real teeth** — `Frontend dependency audit` job now fails the build on any critical vulnerability in production dependencies (`exit 1` if found); the devDependency-inclusive audit stays informational-only. This is the fix I recommended for the previously toothless `|| true` step.
- [x] Everything from the prior "tier-gate bypass" report remains fixed and covered by its regression test.

## 🚨 CI Is Still Red — But For a Different, More Specific Reason Now

The lockfile fix didn't turn CI green. Digging into the actual job/step failures on the current HEAD (`ba879f1c`):

| Workflow | Job | Failing step |
|---|---|---|
| Tests | React tests (Jest + RTL) | **Install** |
| Security Scan | Frontend dependency audit | **Install** |
| Security Scan | CodeQL (javascript-typescript) | Perform CodeQL Analysis |
| PR Build Check | Build standard / pro / ultra | Docker build |

- [ ] I reproduced `yarn install --frozen-lockfile` successfully in this sandbox — but this sandbox runs **Node 22**, while every CI workflow and both Dockerfiles pin **Node 20** (`node-version: '20'` in the workflows, `FROM node:20-alpine` / `FROM node:20-slim` in the Dockerfiles).
- [ ] Strong lead: `yarn install` here surfaced this warning — `@testing-library/jest-dom@6.10.0: ... requires Node >=22`. `package.json` declares `"@testing-library/jest-dom": "^6.9.1"`, a range wide enough to resolve to 6.10.0, which is what appears to have gotten locked into `yarn.lock` (likely because it was regenerated on a Node 22 machine). Under CI/Docker's Node 20, that install path is a plausible point of failure.
- [ ] This one root cause would explain **all three** currently-failing workflows at once: Jest tests, the frontend dependency audit, and all three Docker tier builds all run `yarn install`/build the frontend under Node 20.
- [ ] I can't fully confirm from here — GitHub's job logs require repo-admin auth to download, which I don't have. Two ways to close this out:
  1. Fastest: open the failing "Install" step log directly in the GitHub Actions UI (you have access) and confirm the exact npm/yarn error.
  2. Fix candidate either way: bump `node-version` to `22` in `tests.yml`/`security-scan.yml` and `FROM node:20-...` to `node:22-...` in both Dockerfiles to match what the lockfile was actually generated against — or pin `@testing-library/jest-dom` back to `6.9.1` (Node-20-safe) and regenerate the lockfile on Node 20 instead.
- [ ] `CodeQL (javascript-typescript)` failing at "Perform CodeQL Analysis" is worth a separate look once the install issue is sorted — it may or may not share the same cause.

## 🟡 Unchanged From Last Scan — Still Needs a Decision

- [ ] **Auto-patch system trust model.** No changes here since the last pass: `PatchService`/`UpdateBackgroundService` still verify file integrity via SHA-256 sourced from the same channel as the payload, with no independent signature check, and `auto_install_patches` still defaults to `true`. Still a reasonable, deliberate design per `docs/UPDATE-SYSTEM.md` — just flagging that it hasn't been revisited yet and is the one subsystem with real code-execution blast radius across every install.

## Suggested Order of Operations

1. Confirm the Node 20 vs. Node 22 mismatch via the Actions log, then align versions (bump CI/Docker to 22, or repin `jest-dom` + regenerate the lockfile on Node 20) — this should turn Tests, Security Scan, and PR Build Check green in one shot
2. Decide on the patch-system signing question before a wider release
3. Nothing else outstanding from the prior three audits — the rest is fixed and verified
