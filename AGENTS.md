# Project handoff

Read [HANDOFF.md](HANDOFF.md) when starting or resuming work. Before switching between Claude and Codex, record the current task, changes, checks and next step there.

## Verify

Run these from the project root before calling a change done. They are the scripts package.json defines.

- Test: `npm test` (runs `npm run verify:source && npm run build && npm run test:delivery && npm run test:simulation && npm run test:workshop`)
- Build: `npm run build` (runs `node scripts/build.mjs`)
