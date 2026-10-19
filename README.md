# Teamspace

A lightweight workspace for a team leader: daily assignments, strengths and coaching focus, capacity, one-to-one notes, and team bonding activities.

## Run

Requires Node.js 18 or newer. No packages, credentials, database, or installation needed.

```sh
cd /workspace/team-tool
npm start
```

The server uses port 3000 (`PORT` overrides it). Open the server address in your browser. The **How to use** tab contains the full guide.

## Daily workflow

1. Add members under **Team & growth**. Capture strengths, growth focus, capacity, and next check-in.
2. Create daily assignments under **Daily tasks**, including owner, work date, due date, priority, and status.
3. Update progress and explain blockers. Use filters to review one person or day.
4. Schedule bonding, learning, recognition, and retrospectives under **Team connection**. Check activities off and record outcomes.
5. Export backups regularly. Import replaces the current records after confirmation.

Data is stored in browser localStorage, per browser and site address. This is a single-leader tool without authentication, shared accounts, cloud sync, or a server database. Clearing browser storage deletes records. Exported backups contain notes and should be kept securely. No sample records are mixed into your real team data.

## Checks

`npm test` runs the existing server smoke test (starts an isolated server and checks application assets and unknown routes).

## Deploy with Docker

From the repository root:

```sh
docker build -t teamspace .
docker run -d --name teamspace --restart unless-stopped -p 3000:3000 teamspace
```

Configure your hosting platform to build `Dockerfile` and route traffic to container port **3000**. The server binds to `0.0.0.0`. If the platform supplies a `PORT` variable, the server and health check use that port; configure routing to match. No secrets, installation step, or persistent server volume is required.

The image runs as the unprivileged `node` user and includes an HTTP health check. Check deployment health with `docker inspect --format='{{.State.Health.Status}}' teamspace` and logs with `docker logs teamspace`.

For a public deployment, put the service behind your hosting platform's HTTPS endpoint. Team data stays in each user's browser; deploying does not enable team sharing or cross-device sync. Keep a stable URL so browser storage remains accessible, and export a backup before changing domains.
