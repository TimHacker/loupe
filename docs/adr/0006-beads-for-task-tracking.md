# ADR-0006: Beads for task tracking, synced to GitHub Issues

- **Status:** Accepted
- **Date:** 2026-05-18

## Context

This is a personal, AI-assisted build. Task tracking needs to be:

- Visible to AI coding agents working in the repo, so they can claim work and update status without round-tripping a web UI.
- Durable in the repo — issue history survives a GitHub outage or a repo migration.
- Visible from a phone or laptop without an SSH connection.

The off-the-shelf options:

- **GitHub Issues alone** — good web/mobile UX, but agents have to call the GH API for every read and the data lives only on GitHub.
- **Markdown TODO files** — durable in the repo, but no structure, no sync, no priorities.
- **Beads (steveyegge/beads)** — repo-local Dolt DB with a CLI, plus a JSONL export and built-in two-way sync to GitHub Issues.

## Decision

Use Beads as the primary task tracker. `.beads/issues.jsonl` is committed for durability and offline review. `bd github sync` pushes and pulls against GitHub Issues so the web/mobile UX is also available. Triage on either side; the sync reconciles.

## Consequences

- Adds one extra tool to the local setup (`brew install beads`).
- Two surfaces for the same issues — risk of divergence if `bd github sync` is skipped for long. Run it manually at the end of a working session.
- The Dolt DB itself is gitignored; only `.beads/issues.jsonl` lives in version control, so merges across branches are reasonable.
- Beads is young software; if it disappears, the JSONL export is human-readable and the GitHub Issues mirror is a viable fallback.
