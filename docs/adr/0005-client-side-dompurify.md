# ADR-0005: Sanitise article HTML on the client with DOMPurify

- **Status:** Accepted
- **Date:** 2026-05-18

## Context

Feed items carry HTML bodies of varying trustworthiness. They are rendered into the reader view and must be sanitised before insertion into the DOM to prevent stored XSS. Two natural points to do it:

- **Server-side**, in the `refresh-feeds` Edge Function, using `sanitize-html` (Node) — write only sanitised HTML to Storage.
- **Client-side**, at render time, using DOMPurify on the HTML loaded from Storage.

Supabase Edge Functions are Deno. `sanitize-html` is a Node package that pulls in `htmlparser2` and a moderately large dependency tree. It can be made to work via `npm:` specifiers but adds bundle weight to a function that runs on every refresh of every feed.

## Decision

Store raw HTML in Storage. Sanitise on the client at the point of DOM insertion, using DOMPurify with a conservative allowlist (no `script`, no `iframe` except whitelisted hosts like YouTube embeds if we later add inline embedding, no event handlers).

## Consequences

- The Edge Function stays small and Deno-native — `fast-xml-parser` is the only parsing dep, no `htmlparser2`.
- Sanitisation runs in the user's browser, which is the correct trust boundary anyway: the DOM is the asset being protected.
- DOMPurify is well-audited and battle-tested. A regression in our config could expose XSS, so the DOMPurify config sits in one place (`src/lib/sanitize.ts`) and gets a unit test pinning its behaviour on known-malicious inputs.
- If a future feature renders article HTML server-side (it shouldn't), this decision needs to be revisited.
