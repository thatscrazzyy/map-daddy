# Contributing To Map Daddy

Thanks for helping improve Map Daddy. This project is early, so focused changes with clear testing notes are much easier to review than broad rewrites.

## Development Setup

Run the backend, relay, and frontend in separate terminals:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python main.py
```

```powershell
cd relay
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/dashboard`.

## Before You Commit

Run the checks that match your change:

```powershell
cd frontend
npm run build
npx playwright test
```

```powershell
cd relay
npm test
```

```powershell
cd backend
python -m pytest
```

## Pull Request Guidelines

- Keep PRs scoped to one behavior or topic.
- Include a short summary and testing notes.
- Add or update tests for user-facing behavior.
- Do not commit `.env`, media uploads, backend project data, logs, tunnel credentials, or generated build output.
- Prefer the existing project state model and repository/realtime abstractions over one-off storage or socket code.

## Code Style

- Frontend: React components should stay small and behavior-focused.
- Rendering: keep projector code lightweight and avoid editor-only state in projector components.
- Realtime: throttle noisy editor updates and make reconnect behavior deterministic.
- Backend: keep project storage behind clear API boundaries so it can be replaced by hosted storage later.

## Good First Contributions

- Improve docs and screenshots.
- Add projector rendering tests.
- Add keyboard nudging for selected surfaces.
- Add better image/video metadata handling.
- Improve Cloudflare deployment documentation.
