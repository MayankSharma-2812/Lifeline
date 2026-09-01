/**
 * @file cluster.js
 * @description Master-Worker Cluster Load Balancer for LifeLine.
 *
 * Concepts demonstrated in this file:
 * - Load Balancing & Horizontal Scaling: Multi-process architecture distributing incoming TCP connections across CPU cores
 * - Inter-Process Communication (IPC): Master process managing worker lifecycles and messaging
 * - Fault Tolerance & Self-Healing: Automatic worker respawn on unexpected termination with backoff
 * - Round-Robin Scheduling: OS/Node cluster scheduling policy (cluster.SCHED_RR)
 */
const cluster = require('cluster');
const os = require('os');

// Determine worker count: either custom environment variable or total CPU cores
const numCPUs = os.cpus().length;
const WORKERS = parseInt(process.env.WEB_CONCURRENCY || process.env.WORKERS, 10) || Math.max(1, Math.min(numCPUs, 4));

if (cluster.isPrimary || cluster.isMaster) {
  // eslint-disable-next-line no-console
  console.log(`[Cluster Master] PID ${process.pid} is running`);
  // eslint-disable-next-line no-console
  console.log(`[Cluster Master] Spawning ${WORKERS} worker processes across ${numCPUs} CPU cores...`);

  // Explicitly configure Round-Robin scheduling policy for even distribution
  cluster.schedulingPolicy = cluster.SCHED_RR;

  // Track worker restarts to prevent rapid crash looping
  const restartTimestamps = [];
  const MAX_RESTARTS_PER_MINUTE = 10;

  // Fork worker processes
  for (let i = 0; i < WORKERS; i++) {
    const worker = cluster.fork();
    worker.on('message', (msg) => {
      // IPC message handling between Master and Worker
      if (msg.type === 'HEARTBEAT') {
        // Heartbeat received
      }
    });
  }

  // Handle worker exit event (Self-Healing / Fault Tolerance)
  cluster.on('exit', (worker, code, signal) => {
    const now = Date.now();
    restartTimestamps.push(now);
    // Retain only restarts from the last 60 seconds
    const recentRestarts = restartTimestamps.filter((ts) => now - ts < 60000);

    // eslint-disable-next-line no-console
    console.warn(`[Cluster Master] Worker PID ${worker.process.pid} died (code: ${code}, signal: ${signal}).`);

    if (recentRestarts.length > MAX_RESTARTS_PER_MINUTE) {
      // eslint-disable-next-line no-console
      console.error('[Cluster Master] Crash loop detected (>10 crashes/min). Throttling respawn by 5s.');
      setTimeout(() => {
        const newWorker = cluster.fork();
        // eslint-disable-next-line no-console
        console.log(`[Cluster Master] Respawned replacement Worker PID ${newWorker.process.pid}`);
      }, 5000);
    } else {
      const newWorker = cluster.fork();
      // eslint-disable-next-line no-console
      console.log(`[Cluster Master] Instantly respawned replacement Worker PID ${newWorker.process.pid}`);
    }
  });

  // Graceful termination of cluster on SIGINT/SIGTERM
  const handleShutdown = (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[Cluster Master] Received ${signal}. Shutting down all workers gracefully...`);
    for (const id in cluster.workers) {
      cluster.workers[id].process.kill(signal);
    }
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

} else {
  // Worker Process: Start the standard Express + Socket.io application
  require('./index');
  // eslint-disable-next-line no-console
  console.log(`[Cluster Worker] Worker PID ${process.pid} initialized and listening on shared port`);
}
