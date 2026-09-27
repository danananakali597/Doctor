# VEX Security 2.0

Discord bot with security controls. The deployable source is bundled in `KurdBot.zip` for the Railway Dockerfile. The dashboard has grouped navigation, tier filters and per-module controls in English, Arabic, Sorani and Turkish.

## Plans

Basic: message spam/links/invites/mentions/words/caps and length filters, logs, join/leave monitoring.
Plus: join-burst detection, manual verification, account-age checks, timed quarantine, anti-bot, domain/URL heuristics, voice hopping protection, audit logs, trust lists.
Ultimate: audit-based Anti-Nuke, mass ban/kick detection, channel/role/webhook monitoring, permission escalation response, protected resources, lockdown, scanner/score, reports/timeline, structure backup/restore, tamper/owner alerts, repeated-incident rules.

Displayed $5/$10 monthly per-server prices are proposals. Billing is NOT connected. Basic is the default. Only the Discord application owner can grant seven-day test access in Plans. Entitlements and expiry are enforced server-side for API writes and events.

## Setup

Node 24, `npm ci`, configure `.env.example`, `npm start`. Enable Server Members and Message Content intents. OAuth redirect is `PUBLIC_URL/auth/callback`. Use HTTPS outside localhost.

Railway: mount a persistent volume at `/app/data` BEFORE public use. SQLite holds settings, incidents, sessions, entitlements, quarantines and backups. Without a volume these are lost on container replacement. One replica only. Healthcheck `/health` succeeds when Discord is ready.

The invite requests explicit permissions, not Administrator. Place the bot's role above the roles it should manage. Missing permissions and hierarchy failures are reported.

## Authorization

Every guild request checks fresh Discord membership and Manage Server permission. Configuration changes additionally require Administrator. Trust/excluded roles, protected resources, backup and lockdown are guild-owner-only. Quarantine approval requires Moderate Members and a higher moderator role. Trial grants require Discord application ownership. Writes require an exact origin and CSRF token. OAuth state is bound to the initiating browser. Secrets never go to the frontend.

## Limits and operation

New modules are OFF except logs and join/leave monitoring. Responses default to log only; granting a trial does not activate punitive rules.

- Anti-Nuke reacts after audit events arrive; cannot guarantee prevention, override the owner or act above the bot role. It can remove manageable dangerous actor roles. Permission Guard also attempts to undo newly added dangerous permissions/role assignments.
- Verification uses a finite Discord timeout with moderator approval, NOT CAPTCHA. Timeout expiry releases the member. Approval refuses a timeout subsequently modified by another moderator and remains available after plan expiry.
- Scam/URL detection uses configured domains and heuristics, not a reputation feed. It does not fetch links or expand redirects. False positives and evasions are possible.
- Voice protection detects rapid joins/switches, not audio content. Basic AutoMod is application-side, requires the bot online and Message Content intent.
- Lockdown modifies five messaging permission bits on selected channels' @everyone overwrites. Administrator and explicit role/member allows bypass it. Unlock restores those bits while preserving unrelated permission changes and remains available after expiry.
- One backup per guild stores role metadata, supported categories/text/announcement/voice channels and VEX settings. Restore recreates MISSING structure with new IDs/remapped overwrites. It does not overwrite existing resources or restore messages, member roles, exact role order or automatically apply archived settings. A separate owner-confirmed action restores archived VEX settings and remaps resource IDs. Channels with missing required overwrite roles/parents are skipped. Results report each failure. A persisted ID map prevents repeat restore duplication.
- Logs retain the latest 1,000 events/server; UI shows 100; reports export 1,000. No message contents are stored. Scanner score is a checklist, not a guarantee. Owner DMs may fail if DMs are disabled; local logs remain.

## Commands

`/help`, `/security`, `/verify member`, `/scan`, `/lockdown enabled`. Help and security now show a private interactive embed with Basic, Plus, Ultimate and a dashboard link. Global registration replaces the old AI/voice/general command list.

## Validation

`npm run check`; `npm test`. Tests cover filters, expiry, tenant isolation, permissions, authentication, CSRF and plan enforcement. Destructive recovery needs testing in a dedicated Discord test server before public release.

## Per-event server logs

Server logs provides 50 independent event controls across members, messages, moderation, channels/threads, roles, voice, and server changes. Each event has an enable switch, its own text/announcement destination channel, and a six-digit embed color. Includes search, category filters, preview and four dashboard languages. All new log events default OFF. Save applies the configuration; enabled events require a valid destination and View Channel, Send Messages and Embed Links. Audit-derived events additionally require View Audit Log.

Only events observed while the bot is online are recorded. Message bodies and attachments are not retained; edits/deletions log available IDs. Uncached authors may be unavailable. Audit entries provide actors only for the corresponding audit events; no actor is guessed for gateway events. Moderator voice move/disconnect records may include a count without individual target IDs. Timeout expiry may not generate a Discord member-update event. The existing 1,000-event retention is shared with security incidents. Backup restoration remaps log destinations, disabling unavailable ones.

Validation includes per-event merge behavior, tenant isolation, disabled delivery, selected color/routing, metadata-only message records, audit actor handling, and channel/permission enforcement.
