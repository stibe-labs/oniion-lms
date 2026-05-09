// PM2 ecosystem config for stibe-portal.
//
// We run 4 fork-mode workers, each on its own port (3000-3003), and nginx
// upstream load-balances across them with `keepalive 64`. This avoids the
// pitfalls of PM2 cluster mode + npm wrapper (npm doesn't forward the
// port-sharing FD that PM2's cluster master passes), and gives us:
//   • Linear API throughput scaling across the 4 vCPUs
//   • Crash isolation — if one worker OOMs, nginx skips it
//   • Per-worker memory cap — leak in one process doesn't take down the others
//   • Zero-downtime deploys via `pm2 reload` (rolling restart)
//
// To start/restart: pm2 reload ecosystem.config.cjs --update-env

const baseConfig = (port) => ({
  script: 'npm',
  args: 'start',
  cwd: '/var/www/stibe-portal',
  exec_mode: 'fork',
  instances: 1,
  max_memory_restart: '800M',
  kill_timeout: 5000,
  merge_logs: true,
  env: {
    NODE_ENV: 'production',
    PORT: String(port),
  },
});

module.exports = {
  apps: [
    // Ports 3001/3002/3003 are taken by stibe-erp, stibe-crm, and
    // stibe-lms-test respectively, so portal workers use 3000 + 3010-3012.
    { name: 'stibe-portal',   ...baseConfig(3000) },
    { name: 'stibe-portal-1', ...baseConfig(3010) },
    { name: 'stibe-portal-2', ...baseConfig(3011) },
    { name: 'stibe-portal-3', ...baseConfig(3012) },
  ],
};

