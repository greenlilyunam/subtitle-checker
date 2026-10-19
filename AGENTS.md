# AGENTS.md

## Project mission

Build a reliable browser-only MVP called “字幕检查器”. It helps new-media operators, copy/content operators, and video editors inspect an SRT before delivery.

Core flow:

`upload one SRT → choose rules → inspect issues → accept / ignore / edit → export UTF-8 SRT`

Read these files before changing code:

1. `PRD.md`
2. `RULES.md`
3. `UI-SPEC.md`
4. `VISUAL-PROMPT.md`
5. `ACCEPTANCE.md`
6. `samples/README.md`
7. files in `design/`

When requirements conflict, use this precedence:

1. `RULES.md` for parsing, checking, mutation, and export behavior
2. `PRD.md` for product scope and functional requirements
3. `ACCEPTANCE.md` for definition of done
4. `UI-SPEC.md` for interaction and visual behavior
5. `VISUAL-PROMPT.md` for visual direction and visual QA
6. design wireframes for information architecture

Do not silently choose a different behavior when a real conflict remains. Report the conflict and ask one focused question.

## Required stack

- React
- TypeScript with strict mode
- Vite
- Tailwind CSS
- Lucide icons
- Vitest for unit tests
- npm unless an existing lockfile establishes another package manager

Prefer browser APIs and small, focused utilities. Do not add a production dependency when a short, well-tested local implementation is sufficient. Ask before adding a major UI framework, state framework, parser framework, analytics SDK, backend SDK, or cloud service.

## Architecture constraints

- This is a client-only application.
- Do not add a backend, database, authentication, API key, server action, cloud upload, telemetry, or external AI call.
- Subtitle bytes and text must not leave the browser.
- Process one SRT file per session.
- Session state may live in React state; it does not need persistence after refresh.
- Keep parsing/serialization and rule logic independent from React components.
- Prefer pure functions for rules so they can be unit-tested.
- Preserve immutable original subtitle data separately from the working copy.
- Keep a transaction-based undo stack; one batch action is one transaction.

Suggested modules (adapt names when useful, but keep the separation):

```text
src/
  components/
  features/upload/
  features/review/
  features/rules/
  features/export/
  lib/srt/parser.ts
  lib/srt/serializer.ts
  lib/rules/
  lib/undo/
  types/
```

## Product scope

Implement only P0 in `PRD.md`.

Do not implement:

- translation or localization
- terminology or brand dictionaries
- video/audio upload or transcription
- automatic timecode repair
- multiple-file processing
- login, user accounts, history, cloud storage
- collaboration, comments, approvals
- CapCut/Jianying plugin
- subscription, payments, analytics dashboard

If a design image shows any out-of-scope feature, omit it and report the discrepancy.

## Rule behavior

- Content rules default to OFF.
- Structural checks default to ON.
- Content suggestions never overwrite text before user acceptance.
- Structural issues are warnings/errors only; do not auto-fix them.
- Never discard an unparseable block silently.
- Export must follow `RULES.md` exactly.
- Recompute relevant issues after accepting a suggestion or saving a manual edit.

## UI requirements

- Chinese UI copy.
- Desktop-first, designed for 1440px and usable at 1024px.
- Mobile layout is out of scope.
- Use the design tokens in `UI-SPEC.md`.
- Avoid gradients, glassmorphism, excessive rounded cards, decorative glows, and generic AI imagery.
- Do not convert the upload page into a marketing landing page.
- Preserve keyboard focus, labels, accessible names, and non-color status cues.
- Do not wait for a Stitch or Figma mockup. Generate the visual UI from `VISUAL-PROMPT.md` and implement it directly in code.
- Before implementation, propose three concise visual directions, select the best fit, and continue without blocking for approval.
- After implementation, inspect the real rendered UI at 1440 × 960 and 1024 × 768.
- In each visual refinement round, change no more than three high-impact issues.

## Testing requirements

At minimum, add unit tests for:

- UTF-8 BOM removal
- LF and CRLF parsing
- multi-line subtitle preservation
- malformed sequence detection
- malformed timecode detection
- start time greater than or equal to end time
- empty subtitle detection
- overlap detection and exact adjacency
- trailing punctuation removal, including punctuation before closing quotes
- English first-letter capitalization
- whitespace normalization while preserving line breaks
- combined content rules in the required order
- ignored vs accepted vs manually edited export behavior
- UTF-8 SRT serialization using CRLF
- parser → serializer → parser round trip for valid samples

Use files in `samples/` as fixtures where practical. Do not alter expected sample files merely to make a failing implementation pass; reconcile behavior with `RULES.md` first.

## Verification commands

Before handoff, run the available equivalents of:

```bash
npm run lint
npm run test -- --run
npm run build
```

Also start the development server and report the exact local URL. Manually verify the complete path:

1. Upload `samples/mixed-issues.srt`.
2. Enable all three content rules.
3. Run checks.
4. Accept some suggestions, ignore one, and manually edit one.
5. Undo the last operation.
6. Export.
7. Re-import the exported SRT.

## Change discipline

- Inspect existing files before editing.
- Keep changes focused on the requested milestone.
- Do not rewrite unrelated user changes.
- Do not replace established design or product decisions with personal preferences.
- If blocked, state the exact blocker, affected requirement ID, and smallest decision needed.
- After implementation, report changed files, checks run, results, and known limitations.

## Privacy and safety

- Never log full subtitle contents to remote services.
- Do not add error-reporting SDKs.
- Do not send samples to external APIs.
- Do not request or store credentials.
