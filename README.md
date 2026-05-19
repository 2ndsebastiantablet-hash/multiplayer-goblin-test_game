# Multiplayer Goblin Test Game

A tiny browser multiplayer test built for Cloudflare Workers + Durable Objects.

Features:
- Create public or private rooms
- Private room codes
- Public server list
- Join/leave rooms
- Host transfer when the host leaves
- Host kick controls
- AFK auto-kick after 3 minutes
- Username movement sync in a blank void

## Local setup

```bash
npm install
npm run dev
```

## Deploy to Cloudflare

```bash
npm run build
npx wrangler deploy
```

For Cloudflare Dashboard deployment, connect this GitHub repo, use `npm run build` as the build command, and `dist` as the build output folder. The Worker uses `worker/index.js`.
