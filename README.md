# EGPS Family Feud Game

Web-based Family Feud tournament game for the EGPS company conference event. Built as a React SPA on AWS (S3 + CloudFront + DynamoDB).

## Local development

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm install
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run dev
```

Visit http://localhost:5173/admin in one window and http://localhost:5173/projector in another. State syncs across windows via localStorage (dev) or DynamoDB (deployed).

## Tests

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run test:run
```

## Deploy to AWS

Prereq: AWS CLI configured with credentials (`aws sts get-caller-identity` should work). CDK requires the target account/region to be bootstrapped:

```bash
cd infra && PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npx cdk bootstrap
```

Then from the project root:

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run deploy
```

This provisions S3+CloudFront+DynamoDB+Cognito (idempotent), builds the SPA with the right env vars, syncs to S3, and invalidates the CloudFront cache. The deploy URL prints at the end.

> **Note:** AWS session credentials were expired at the time of last deploy attempt. Run `aws login` or refresh your SSO session, then re-run `npm run deploy`.

## How to run a tournament

Day-of-event quick reference:

1. Connect projector via HDMI in **extended display** mode (not mirrored). Set projector to 1920x1080.
2. Open the deployed URL `/admin` on the laptop screen.
3. Click **Open Projector Window** in admin. Drag the new window to the projector display, F11 to fullscreen.
4. **Register 6 teams** in admin (team name + member names) then click **Start Tournament**.
5. For each match: Face-off, reveal answers, mark strikes, award points, advance to next match.
6. Use the projector glyph buttons in admin (top-right) to switch the projector between the game-mode view and the bracket view.
7. After Round 1 completes, the system auto-computes the wildcard team and slots them into Semi 2.
8. Final -> Fast Money -> champion declared.

## Recovery

- Browser crashes? Reopen `/admin` — the in-progress tournament resumes from localStorage (or DynamoDB if deployed). Re-open projector window if needed.
- Misclicked? **Undo** button in admin (Ctrl+Z hotkey arrives in Plan B).

## Architecture

- Frontend: React 19 + Vite + TypeScript, deployed as a static SPA on S3 + CloudFront.
- State: single-tournament reducer in browser, persisted to DynamoDB via Cognito unauth identity pool.
- Cross-window sync: admin writes, projector polls every 750ms.
- See `docs/superpowers/specs/2026-05-05-family-feud-game-design.md` for full design.

## Status

This is the **MVP** (Plan A) — functional, end-to-end, minimal styling. Visual polish + audio + Fast Money theatrics are Plan B (`docs/superpowers/plans/2026-05-05-family-feud-polish.md`).
