# Forge Issues for VS Code

Browse and create Forge issues without leaving your editor.

## Setup

1. Install this extension from VSIX (Extensions → ··· → Install from VSIX)
2. Open Settings (`Cmd+,`) and search for "forge"
3. Set:
   - **forge.apiUrl** — your Forge instance URL (default: `https://useforge.dev`)
   - **forge.tenantSlug** — your workspace slug (e.g. `acme`)
   - **forge.apiKey** — an API key from Forge → Settings → API Keys
   - **forge.projectKey** — project to show (e.g. `FORGE`). Leave blank for all.

## Features

- **Issues sidebar** — all issues grouped by status (In Progress → In Review → Todo → Backlog → Done)
- **My Issues** — filtered to issues assigned to you
- **Create issue** — `Cmd+Shift+P` → "Forge: Create Issue" or click the `+` in the sidebar
- **Open in browser** — click any issue to open it in Forge
- **Copy issue key** — right-click → "Copy Issue Key" (e.g. `FORGE-42`)
- **Auto-refresh** — updates when you change settings

## Commands

| Command | Description |
|---------|-------------|
| Forge: Refresh Issues | Reload from API |
| Forge: Create Issue | Open create form |
| Forge: Open Settings | Jump to Forge settings |
