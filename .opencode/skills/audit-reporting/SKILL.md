---
name: audit-reporting
description: Use when producing structured audit reports. Provides the standardized report template, severity definitions, and cross-referencing rules for multi-agent audit results.
---

# Audit Report Standard

## Report Structure

```markdown
# Audit Report: [Scope] — [Date]

## Executive Summary
[Health score: GOOD / MODERATE / POOR / CRITICAL]
[Key metrics: files scanned, issues found by severity]
[Top 3 most critical findings]

## Summary
| Severity | Count | % of Total |
|----------|-------|------------|
| CRITICAL |       |            |
| HIGH     |       |            |
| MEDIUM   |       |            |
| LOW      |       |            |
| INFO     |       |            |
| **Total**|       | 100%       |

## Findings by Dimension
(Include only dimensions that were audited)

### [🔴 Security] or [🏗️ Architecture] or [⚡ Performance] or [📐 Quality] or [📦 Dependencies] or [🔒 Tier Enforcement]

| # | Severity | File | Line | Category | Finding | Impact | Remediation |
|---|----------|------|------|----------|---------|--------|-------------|
| 1 | CRITICAL | src/... | 42 | Secrets | TMDB API key in appsettings.json | Anyone with repo access can use API key | Move to env vars or secret manager |
```

## Severity Definitions
| Severity | Meaning | Action |
|----------|---------|--------|
| CRITICAL | Active exploit, data breach, or system compromise | Fix immediately |
| HIGH | Significant vulnerability or degradation | Fix this sprint |
| MEDIUM | Notable issue or best practice violation | Fix next sprint |
| LOW | Cosmetic or stylistic | Fix when convenient |
| INFO | Observation or suggestion | No action required |

## Cross-Reference Rules
1. If two auditors find the same issue, merge and cross-reference IDs (e.g., "see also SEC-003")
2. If a finding in one dimension has implications for another, cross-reference both
3. Duplicate findings count once but note both origins in the merged entry

## Remediation Prioritization
1. **CRITICAL/HIGH**: Remediation suggestion must include specific code change
2. **MEDIUM**: Include general approach and example
3. **LOW/INFO**: Reference best practice documentation

## Health Score
- **GOOD**: 0 CRITICAL, <3 HIGH, <10 MEDIUM
- **MODERATE**: 1-2 CRITICAL or 3-5 HIGH
- **POOR**: 3+ CRITICAL or 5+ HIGH
- **CRITICAL**: 5+ CRITICAL or 10+ HIGH
