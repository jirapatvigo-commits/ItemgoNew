# AGENTS.md

## Project Context

Itemgo is a user-owned React app with a first-party Node.js API and MySQL database. Keep changes focused and preserve existing project conventions.

Read `README.md` for local setup and deployment instructions. Never commit `.env`, credentials, or uploaded user files.

## Key Files

- `src/`: React frontend.
- `src/api/appClient.js`: first-party frontend API client.
- `server/index.js`: Node.js REST API, authentication, and MySQL persistence.
- `.env.example`: configuration template; local secrets belong in `.env`.
- `vite.config.js`: frontend configuration and local `/api` proxy.

## Working Notes

- `npm run dev` starts both the API and Vite frontend.
- The API expects a reachable MySQL database; it creates its tables during startup.
- `npm run build`, `npm run lint`, and `npm run typecheck` are the available project checks.
- Keep authentication and database writes on the backend. Do not store passwords in plaintext or expose database credentials to the frontend.
