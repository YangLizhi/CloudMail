<p align="center">
  <img src="assets/icon.png" alt="CloudMail" width="64" height="64" style="border-radius: 24px;" />
</p>

<h1 align="center">CloudMail</h1>

<p align="center">
  <strong>Local-first · Private · AI-enhanced desktop email client</strong><br />
  <em>Email at the speed of thought.</em>
  <br />Version <strong>0.5.2</strong> · 2026-08-27
</p>

<p align="center">
  Built with Tauri v2 + React + Rust (a renamed & upgraded continuation of the Velo project). Supports Gmail / IMAP / SMTP with a built-in AI assistant, skills system, meeting scheduling and auto-reply.
</p>

<p align="center">
  <a href="#features">Features</a> · <a href="#usage">Usage</a> · <a href="#installation">Installation</a> · <a href="#build-from-source">Build from Source</a> · <a href="#data-and-privacy">Data &amp; Privacy</a> · <a href="#tech-stack">Tech Stack</a> · <a href="#license">License</a>
</p>

---

## Why CloudMail

- **Local-first**: email lives in a local SQLite database. No middleman servers; read your mail offline.
- **Keyboard-driven**: a rich set of shortcuts lets you fly through mail without touching the mouse.
- **AI-enhanced**: conversational assistant, message summaries, smart replies, task extraction, meeting scheduling, attachment Q&A — with customizable models and skills.
- **Native performance**: a Rust backend (Tauri v2) keeps it small, lean and fast to start.
- **Privacy by default**: remote images are blocked, HTML is sanitized, mail renders in a sandboxed iframe, and data stays on your machine.
- **Note**: CloudMail is a continuation of Velo v0.4.21 with a redesigned UI, expanded AI features, full Simplified-Chinese support and several critical fixes. Because Velo is no longer maintained, this project lives on in its own repository.

---

## Features

### Mail

- Multiple accounts: Gmail (API) and IMAP/SMTP (Outlook, Yahoo, iCloud, Fastmail, 163 and more) with instant switching
- Threaded reading: messages are folded by thread and expandable with one click
- Full-text search with Gmail-style operators: `from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, …
- Command palette (`Ctrl+K` / `/`) for quick actions
- Drag-and-drop archiving/labeling, multi-select batch, pin, mute, context menus
- Split inbox tabs: Primary / Updates / Promotions / Social / Subscriptions
- Inline reply, contact sidebar (Gravatar)
- Integrated layout: the sidebar embeds the message list; the reading pane takes the remaining width

### Compose

- **TinyMCE 6** rich-text editor (document-grade toolbar: font/size/color/highlight, bold/italic/underline/strikethrough, paragraph & heading levels, bullet/numbered lists, alignment/indentation, editable tables, images, links, special characters, clear formatting; inline reply has a left send/cancel rail and an editable subject)
- Undo send, scheduled send, auto-saved drafts
- Multiple signatures and reusable templates (with variables)
- Send-as aliases and sender selection
- Drag-and-drop attachments with inline preview
- Contact autocomplete (ranked by frequency)

### Smart Inbox

- Snooze with presets or custom times
- Filters: auto label, archive, delete, star, mark read
- AI + rule-based auto categorization
- One-click unsubscribe (RFC 8058) and subscription management
- News aggregator and delivery schedules
- Smart folders / saved searches (dynamic query tokens)
- Quick Steps: custom multi-step batch actions
- Follow-up reminders when no reply is received

### AI

OpenAI-compatible providers (Claude / OpenAI / Gemini / Ollama / GitHub Copilot / custom Base URL). Test-connection probes the provider's model list:

| Provider | Notes |
|---|---|
| Claude (Anthropic) | Haiku 4.5, Sonnet 4, Opus 4 |
| OpenAI | GPT-4o Mini, GPT-4o, GPT-4.1 series |
| Google Gemini | 2.5 Flash, 2.5 Pro |
| Ollama / LM Studio | Local models, no API key needed |
| GitHub Copilot | Requires a GitHub PAT |
| Custom | Any OpenAI-compatible endpoint: Base URL + API Key + model |

#### AI features

- **AI chat assistant (right panel)**: follows the open email, references other emails/attachments, renders Markdown, switches models per session, and persists history locally.
- **AI summary**: auto-summarizes threads with 2+ messages (can be set to manual); output language follows the UI language.
- **Smart replies**: fuller 2–3 sentence suggestions; language follows the UI language.
- **AI task extraction**: ask the chat to extract todos, confirm with an "Add to tasks" card, and push them to the left task sidebar.
- **Agentic inbox cleanup**: use natural language (e.g. "archive and star unread from X") to generate an action plan, then execute it in bulk after confirmation.
- **AI meeting scheduling**: tell AI to schedule a meeting; it combines calendar availability, suggests slots, and creates the event on confirmation.
- **Calendar Q&A**: ask "when is my next meeting" and get an answer based on local calendar data.
- **Meeting briefings**: generate agenda / pre-meeting briefs from a calendar event (using related emails).
- **Attachment Q&A**: reference attachments and ask or summarize (txt/html/csv/json/md/docx; PDF for uncompressed text streams).
- **Skills + plugin marketplace**: built-in skills (inbox triage, meeting prep, inbox zero, writing polish, task extraction) and installable remote skills via `/ # @`.

### Calendar

Google Calendar sync, month/week/day views, and direct event creation.

### Auto-reply (Out of Office)

Settings → Auto-reply: create rules (account, start/end time, subject, body, enabled). During the window, each sender is replied to only once, with a reply counter.

### UI & Interaction

- Top menubar: smart-folder / label dropdowns + view navigation; logo + "CloudMail" wordmark in the top-left (`ai` follows the accent color)
- Left sidebar (full height): accounts, compose, search, message list, settings
- Bottom status bar: sync status, mailbox online status, latest inbox info (only at the bottom of the content area)
- Right extension area: tasks / AI assistant / contacts
- Dark / light / system theme with 8 accent colors
- One-click Chinese/English switch, with all UI and settings localized
- Clicking a top-bar category opens the last-read (or first) email in that category

### Privacy & Security

- Gmail OAuth PKCE: no client secret, no backend server
- IMAP passwords encrypted at rest (AES-256-GCM)
- Remote image blocking + sender allowlist
- Phishing link detection (10 heuristic scores)
- SPF/DKIM/DMARC authentication display
- DOMPurify + sandboxed iframe rendering

---

## Usage

### 1. Connect an account

- **Gmail**: create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/) (enable Gmail + Calendar APIs), then paste the Client ID in Settings → Accounts (PKCE, no secret).
- **IMAP/SMTP (including 163)**: account switcher → Add IMAP account, enter email and app password (163 uses "client authorization password"); host/port auto-detect or manual. IMAP delta sync uses a single connection to avoid connection storms.
- **CalDAV calendar**: iCloud, Fastmail, Nextcloud, Zoho and more (calendar sync only).

### 2. Configure AI

Settings → AI:

1. Choose a provider (or "Custom" with Base URL / API Key / model, e.g. `http://192.168.196.114:3000/v1`);
2. Click **Test Connection**: on success it probes the provider's model list;
3. Set a **default model** in the Models section; the candidate list is searchable and can be set as default;
4. The chat panel's model dropdown switches models per session.

### 3. Use the AI assistant

- Open an email and click the ✨ button in the top action bar to open the right AI panel;
- The panel follows the current email by default; just ask (summarize, follow-up, rewrite);
- **Reference more emails/attachments**: click the reference button, search and multi-select; ask about attachments directly;
- **Skills**: type `/`, `#` or `@` to open the skill/command menu (e.g. `/summarize`, `/task`, `/meeting`, `/new`);
- The top Model dropdown switches the model for the current session;
- Output supports Markdown; links/images open in your external browser;
- Input height and panel width are draggable and remembered.

### 4. Tasks & bulk actions

- Say "extract tasks" or type `/task`; AI returns a task card, click "Add to tasks" to write it to the left task sidebar;
- Describe a bulk action ("archive/star/mark read/label ..."), AI produces an action-plan card that runs **after confirmation**;
- The task sidebar supports priority, due dates, subtasks, and thread links.

### 5. Meetings & briefings

- Click "Meeting" in the chat (or say "schedule a meeting"), fill in title, duration, time range, attendees; AI suggests slots from calendar availability, then creates the event;
- Ask calendar questions like "when is my next meeting";
- In a calendar event, click "Generate brief" to get an agenda based on related emails.

### 6. Out-of-office auto-reply

Settings → Auto-reply → New rule: account, start/end time, subject (empty = Re: original), body; auto-replies once per sender within the window.

### 7. Language switch

Settings → General → Language: 中文（简体）/ English one-click switch; AI output, UI copy and subject localization follow.

### 8. Common shortcuts

See [docs/keyboard-shortcuts.md](docs/keyboard-shortcuts.md) for the full list. Common:

- `r` / `a` / `f`: reply / reply all / forward
- `e` archive, `#` delete, `!` spam, `s` star, `h` snooze, `v` move
- `Ctrl+K` or `/`: command palette
- `t`: AI extract tasks from email

---

## Installation

Download the latest release for your platform (Windows installer / macOS / Linux) and run it — no dev environment needed.

### Build from Source

```bash
git clone https://github.com/YangLizhi/CloudMail.git
cd CloudMail
npm install
npm run tauri dev
```

**Requirements**: Node.js 18+, Rust, and the Tauri v2 system dependencies.

Release build (Windows example):

```bash
npm run tauri build -- --target x86_64-pc-windows-gnu --no-bundle
```

> Note: this project optimizes the sync path (single-connection IMAP delta sync + failure backoff) and uses `--no-bundle` to avoid NSIS network downloads.

---

## Data & Privacy

All data is stored locally in the app data directory (Windows: `%APPDATA%\com.cloudmail.app\`):

| File | Description |
|---|---|
| `cloudmail.db` | Main database for mail/threads/calendar/tasks (SQLite + FTS5, WAL mode) |
| `cloudmail-settings.json` | All settings (nested JSON: model caches, skills, auto-reply, …) |
| `cloudmail.key` | Settings encryption key (AES-256-GCM) |
| `cloudmail-chat.json` | AI chat history |
| `cloudmail-debug.log` | Diagnostic log |
| `cloudmail-attachment-cache/` | Attachment cache |

**Storage location**: In Settings → General → Storage you can choose any directory (e.g. another disk) for the mail database. CloudMail moves the existing database (including WAL/SHM) to that location via a directory junction and frees the original drive space. If a previous move was interrupted, the app recovers automatically.

Legacy Velo data is migrated to `com.cloudmail.app` and renamed on first launch — no manual action required.

---

## Tech Stack

| | |
|---|---|
| Framework | Tauri v2 (Rust) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand 5 |
| Editor | TinyMCE 6 |
| Mail | Gmail API, IMAP/SMTP (Rust async-imap + lettre) |
| Database | SQLite + FTS5 |
| AI | Claude / GPT / Gemini / Ollama / any OpenAI-compatible endpoint |
| Tests | Vitest + Testing Library |

See [docs/architecture.md](docs/architecture.md).

---

## License

[Apache-2.0](LICENSE)

---

<p align="center">
  Built with Tauri v2 and React. The open-source continuation of the Velo project: CloudMail.
</p>
