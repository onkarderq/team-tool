# Derq Team Command Center

Derq’s team leadership workspace for daily assignments, strengths and coaching focus, capacity, one-to-one notes, and team bonding activities. All records are stored on the server, and all browsers using that server share one workspace.

## Derq leadership dashboard

The blue command center uses the Derq logo and includes clickable summary tiles that open team, active, blocked, and overdue views. It also includes clickable member cards with active assignments, strengths, growth notes, and the four most recent assignments sorted by work date. The top-right clock shows the browser’s local time and timezone. Delivery and workload visuals use your actual records; no demo members or tasks are added. A clickable execution map shows each task stage, and a seven-day planning chart shows open work by due date. Select any date block to see the tasks due that day, with owners, work dates, status, priority, success criteria, and blockers. Dates with zero tasks show an empty state; completed tasks are excluded to match the chart. The animated team network respects reduced-motion preferences.

Use the leadership action queue to review blocked, overdue, and high-priority work. Check-ins scheduled for today or earlier appear in the coaching queue; update the next date after each conversation. Add success criteria to assignments to clarify the intended outcome. Workload bars compare active task counts and should be discussed alongside each member’s stated capacity.

Existing JSON backups and Docker-volume records remain compatible. This update requires no migration and preserves extra record fields when editing. Rebuild with `docker compose up -d --build` to load the new interface while retaining the existing named volume. Do not delete or recreate the volume. Export a backup before updating a live deployment.

## Quick edits without dialogs

Click a capacity pill to cycle **Balanced → Maximum → Available → Balanced**. Existing “At capacity” records display as “Maximum”; the stored value remains compatible with older backups. Capacity controls work in the team table, dashboard cards, and member profiles.

Type strengths, growth focus, or notes directly in the team table or profile. Changes save when you leave the field; **Ctrl/Cmd+Enter** saves immediately and **Esc** cancels the current text edit. Set check-in dates directly in place.

Click task status to cycle **To do → In progress → Blocked → Done → To do**, click priority to cycle **Medium → High → Low**, or use the due-date picker directly. The server-save indicator confirms persistence; save conflicts retain your changes in memory for export instead of overwriting another session. The full Edit dialog is still available for other fields.

## Leave calendar and daily reminders

**Calendar** in the sidebar shows a full month, with previous/next navigation and a return to the current month. Select a date, check the members on leave, and save. Their names remain on that date after reloads and server restarts. Reopen the date and uncheck names to remove leave. Leave records are included in JSON exports; backups from earlier versions without leave records remain supported.

Set each member’s next one-to-one **date and local time** in Team & growth or their profile. Today’s names and times appear beside the clock. Select the reminder strip to see the list or manage scheduling. A “Soon” label appears in the 15 minutes before a scheduled meeting. These are in-app reminders while the page is open, using the browser’s local timezone.

The rounded task indicator opens **all open tasks due today**. Its color counts tasks due today that were **not created today**: green for zero, orange for one or two, red for three or more. Tasks created and due today appear in the list but do not raise the color. New tasks record their creation date independently of work date; changing a work date does not reset creation. Older records lack that metadata, so their existing work/assignment date is used as the fallback. Completed tasks are excluded. The header updates as tasks and check-ins change and as the local day changes.

The existing Docker data file is read without a forced migration. Leave records are added only when saved, preserving existing members, assignments, activities, and extra record fields.

## Built-in command assistant — no API key

Select the floating **CMD** assistant button at the bottom right. Built-in command mode works immediately: no API key, account, model download, or external AI service is needed. It interprets supported command formats on your own server; it is not a general AI chatbot. Type **help** or select **All commands** for examples.

Send one complete command at a time:

- `Add Maya Rao as a Deployment and Configuration Engineer`
- `Mark Maya Rao on leave on 2026-10-26 and 2026-10-28`
- `Mark Maya Rao on leave from 2026-10-26 to 2026-10-28`
- `Remove leave for Maya Rao on 2026-10-26`
- `Assign "Deployment checklist" to Maya Rao, due tomorrow, high priority`
- `Set task "Deployment checklist" status to done`
- `Set task "Deployment checklist" due date to tomorrow`
- `Set Maya Rao's capacity to maximum`
- `Set strengths for Maya Rao to Mentoring and troubleshooting`
- `Set growth focus for Maya Rao to Ownership`
- `Schedule a one-to-one with Maya Rao tomorrow at 10:30 AM`
- `Plan activity "Team lunch" for Maya Rao on tomorrow, type Team bonding`
- `Append a note for Maya Rao: Lead the next handover`
- `Append a note for activity "Team lunch": Bring snacks`
- `Show tasks due tomorrow`, `Show Maya Rao's profile`, or `Who is off today`
- `Open calendar`, `Export backup`, or `Import backup`
- `Delete member Maya Rao` (requires confirmation)

Dates support YYYY-MM-DD, named months (for example `October 28 2026`), today, tomorrow, and weekdays, using the browser's local date. An explicit leave range includes both endpoints; two listed dates mark only those dates. Numeric slash dates are rejected as ambiguous. Dates without a year use the next occurrence; include the year when recording past leave. Times accept `10:30 AM` or `14:30`. Use full member names and quoted task/activity titles. A unique first name is accepted; duplicate names need the role in parentheses or exact record ID. Duplicate task titles can be qualified with `for Maya Rao`. If details are missing or ambiguous, no changes are made: resend the complete command with the requested details. Commands do not infer references such as “him” from earlier messages.

Commands create, update, and delete members, tasks, and activities; set/remove leave; edit capacity, strengths, growth focus, notes, and check-ins; and open workspace views. Task updates support title, status, priority, due date, work date, owner, blocker, and outcome. Activity updates support title, type, owner, date, status, and notes. `Assign` updates an existing unique task title or creates a new task; `Add task` explicitly creates one. Notes can be appended without replacing existing notes. Imports still require choosing a file and accepting the existing replacement confirmation.

Deletions receive a separate confirmation; other explicit commands apply directly. **Undo this change** restores the preceding snapshot for up to ten minutes if no newer edits would be overwritten. Confirmations and Undo expire on server restart; saved records remain in the Docker volume. Commands are validated and saved atomically with revision checks. Creation metadata and unknown existing fields are preserved. Built-in mode sends no requests to an AI provider, even if an API key happens to be present. Chat history stays only in the current page until reload. The assistant cannot execute shell commands, fetch arbitrary URLs, or directly access files. The shared limit is 120 built-in commands per minute.

### Optional external AI mode

For more flexible language and general team questions, explicitly set `DERQ_ASSISTANT_MODE=ai` and provide `DERQ_AI_API_KEY` securely in the server environment (or the existing ignored Compose `.env`, preserving other settings), then restart/rebuild. An OpenAI API key with API billing is required only for this optional mode. `DERQ_AI_MODEL` defaults to `gpt-4.1-mini`. Keep `DERQ_ASSISTANT_MODE=local` for key-free commands; this is the default.

External mode uses OpenAI's structured Responses API, with storage disabled. Commands and relevant workspace context go to OpenAI; member/activity notes and unknown fields are omitted from context. Explicit note commands are still sent as part of your message. The panel shows the active mode and privacy information. There is a shared limit of 20 AI commands per minute, one active call at a time, and a 45-second provider timeout. Never commit credentials or enter them in chat. Validate a new key with a read-only member-count question before issuing changes. Everyone who can access the shared workspace can use its assistant.

## Clone and deploy locally

Install Git and Docker Desktop (Windows/macOS) or Docker Engine with the Compose plugin (Linux). Start Docker, then run:

```sh
git clone https://github.com/onkartechh/team-tool.git
cd team-tool
docker compose up -d --build
```

Open **http://localhost:3000** in your local browser. Check the deployment:

```sh
docker compose ps
docker compose logs --tail=50 teamspace
```

Compose creates the named volume `teamspace_data`, mounted at `/app/data`. Members, tasks, and activities are written to `teamspace.json` in that volume. Saves use an atomic replacement and flush writes before confirming success. The header shows whether a save succeeded. A failed save displays a message; export your edits before reloading.

## Access from another device

Run Docker on the computer or server that the other device can reach. A private IP inside the Codex cloud workspace is not a public hosting address.

For a phone, tablet, or laptop on the same trusted Wi-Fi/LAN, publish the app on the host’s network interfaces:

```sh
# Linux / macOS
TEAMSPACE_BIND_IP=0.0.0.0 docker compose up -d --build
```

```powershell
# Windows PowerShell
$env:TEAMSPACE_BIND_IP = "0.0.0.0"
docker compose up -d --build
```

Find the host computer’s Wi-Fi/Ethernet IPv4 address (`ipconfig` on Windows, `ipconfig getifaddr en0` for typical macOS Wi-Fi, or `ip -4 addr` on Linux). On the other device, open `http://HOST_LAN_IP:3000`, replacing `HOST_LAN_IP` with that address. Both devices must be on the same reachable network; guest Wi-Fi may isolate devices. If necessary, allow inbound TCP port 3000 only from your private network in the host firewall.

To bind one specific host interface, set `TEAMSPACE_BIND_IP` to its actual LAN IP instead of `0.0.0.0`. `0.0.0.0` means all interfaces; it is not an address to type into a browser. `TEAMSPACE_HOST_PORT` can change the host port if 3000 is occupied. To keep the address stable, reserve the host’s LAN IP in your router’s DHCP settings. These settings change only the published port; the existing `teamspace_data` volume is reused.

For persistent settings, put non-secret `TEAMSPACE_BIND_IP=0.0.0.0` (or the host’s specific IP) in the ignored `.env` file beside `compose.yaml`, preserving any existing entries. Restart with `docker compose up -d`. Without an override, the default remains loopback-only. For internet access, use your own reachable server with an authenticated HTTPS proxy or private VPN; this app has no login, so do not forward port 3000 directly to the public internet.

## Stop, restart, and update

```sh
# Stop and start without deleting records
docker compose stop
docker compose start

# Rebuild after pulling new code; the existing volume is reused
git pull --ff-only origin main
docker compose up -d --build

# Remove containers and network while keeping records
docker compose down
# Restore the deployment using the retained volume
docker compose up -d
```

Records survive container crashes, stops, restarts, and replacement when the volume is reused. **Do not run `docker compose down -v` or delete `teamspace_data` unless you intend to erase the records.** A volume does not protect against disk failure or accidental deletion. Use **Export backup** regularly and keep the downloaded JSON somewhere safe. **Import backup** restores it after confirmation and replaces the shared workspace.

## Deploy without Compose

```sh
docker build -t teamspace .
docker volume create teamspace_data
docker run -d --name teamspace --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v teamspace_data:/app/data teamspace
```

For hosting platforms, attach persistent storage at `/app/data`, set the internal port to **3000**, and run one application instance against that storage. `PORT` and `DATA_DIR` can override these defaults. Docker creates an anonymous volume if you omit the named mount, but it will not automatically be reused by a replacement container: use the named volume or Compose configuration above.

This app has **no login or access control**. The local deployment binds only to your computer. To give your team remote access, put it behind an authenticated HTTPS proxy or private network. Everyone with access can read and change all records. Refresh to see other sessions' changes; conflicting saves are rejected rather than silently overwriting newer data. This file-based deployment supports one server instance, not multiple replicas.

## Daily workflow

1. Add members under **Team & growth**. Record strengths, growth focus, capacity, and next check-in.
2. Create daily assignments under **Daily tasks**, with owner, work date, due date, priority, and status.
3. Update progress and blockers. Filter by member, date, or status.
4. Plan bonding, learning, recognition, and retrospectives under **Team connection**. Check off activities and record outcomes.
5. Review the dashboard and revisit coaching goals weekly. The **How to use** tab includes a full guide.

### Moving data from the original browser-only version

Export backup from the original version before updating. After deploying this version, use **Import backup** in the same or another browser to transfer those records to the server. Imports replace server records, so export any existing server workspace first. Old browser localStorage is not automatically uploaded or deleted.

## Develop without Docker

Requires Node.js 18 or newer; there are no third-party packages to install.

```sh
npm start
npm test
```

The server defaults to port 3000 and stores data in the ignored `data/` directory. Set `DATA_DIR` to use another directory. Tests use isolated temporary storage and verify assets, input validation, stale-save rejection, and persistence across server restarts.
