# TaskSprout

> Grow your day, one task at a time.

A gentle, minimal productivity app built with Electron.js. Features a live-animated ranunculus that blooms at the end of your day based on how many tasks you completed.

---

## Setup

**Requirements:** Node.js 18+

```bash
# 1. Install dependencies
npm install

# 2. Run the app
npm start
```

---

## Features

- **Landing page** — soft swaying flower greets you each day
- **Tasks** — add, check off, and delete tasks; live progress bar with a petal animation at 100%
- **Voice memos** — record notes; AI generates a title from the time of day and duration (double-tap to rename)
- **Day reward** — animated plant grows proportionally to % of tasks completed; full ranunculus bloom at 100%
- **Persistent storage** — todos and memo metadata saved locally via Electron

---

## Data location

| OS      | Path |
|---------|------|
| macOS   | `~/Library/Application Support/tasksprout/` |
| Windows | `%APPDATA%\tasksprout\` |
| Linux   | `~/.config/tasksprout/` |

---

## AI memo titles

Voice memo titles are generated via the Anthropic API (`claude-sonnet-4-20250514`).
Add your API key to the environment or update the fetch call in `src/app.js` to use your preferred method.
