# Stranger Thoughts Runbook

## Stack

- Node.js + Express serves the app and JSON API.
- Socket.IO powers live identity, thoughts, reactions, quote discussions, and one-on-one matching.
- Data persists as JSON files in `data/`.
- Frontend is plain HTML/CSS/JavaScript in `public/`.

## Local Commands

```bash
npm start
npm run check
npm run smoke
```

Use a custom port with:

```powershell
$env:PORT=3012
npm start
```

## Important Routes

- `/` main app
- `/chat.html?quoteId=<id>` quote discussion room
- `/pricing.html` monetization draft
- `/admin.html` local admin view
- `GET /api/stats` app stats
- `GET /api/reports` report queue
- `POST /api/reports` create report
- `DELETE /api/reports/:id` dismiss report
- `GET /api/export` export JSON snapshot
- `POST /api/backup` create a local backup in `data/backups/`

## Safety Notes

The app now has local report storage, local browser blocking, server-side length validation, allowed category/mood/reaction lists, and simple socket rate limits.

Before public deployment, add real authentication for `/admin.html` and admin APIs, production moderation workflows, CSRF protections for mutating HTTP routes, and a database with migrations.

## Quality

`npm run check` validates JavaScript syntax. `npm run smoke` starts a temporary server, checks critical pages/API routes, creates and dismisses a smoke report, and exits.
