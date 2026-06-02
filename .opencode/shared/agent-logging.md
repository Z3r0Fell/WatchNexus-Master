# Agent Logging Protocol

## Log Location
Every agent MUST log to `~/Downloads/git/agent_logs/<agent-name>/<YYYY-MM-DD>.md`

## Log Format
```markdown
# Agent Log — <agent-name> — <YYYY-MM-DD>

## <HH:MM:SS> — <FIND | FIX | INQUIRE>
**Scope**: <dimension or component>
**File**: `<filepath>:<line>` (if applicable)
**Description**: <what happened>
**Details**: <extended context, code snippets, observations>
**Status**: <open | resolved | pending | blocked>

## <HH:MM:SS> — <FIND | FIX | INQUIRE>
...
```

## Log Entry Types
- **FIND**: An issue discovered (bug, vulnerability, quality problem, test failure)
- **FIX**: A correction made (code change, test added, configuration fix)
- **INQUIRE**: A question or clarification needed (unclear requirement, ambiguous behavior)

## Directory Setup
The `~/Downloads/git/agent_logs/` directory exists and is writeable. Each agent creates its own subdirectory on first use. The coordinator agents (audit-coordinator, dev-coordinator, qa-coordinator) may also maintain a unified log.

## Rules
1. Append to existing daily log file — never overwrite
2. Always include a timestamp (HH:MM:SS)
3. Always reference specific files with paths and line numbers
4. Log BEFORE and AFTER for fixes (what changed)
5. When spawning sub-agents, the parent agent should reference child log entries
6. Cross-reference related entries: `(see qa-unit:2026-05-29.md#14:22:33)`
