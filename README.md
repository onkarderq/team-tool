# Teamspace

A team leader's workspace for daily assignments, strengths and coaching focus, capacity, one-to-one notes, and team bonding activities. All records are stored on the server, and all browsers using that server share one workspace.

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
