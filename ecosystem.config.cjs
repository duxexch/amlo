// PM2 Ecosystem Configuration – Aplo Production
module.exports = {
  apps: [
    {
      name: "aplo",
      script: "dist/index.cjs",
      cwd: __dirname,
      instances: "max", // cluster mode – one per CPU core
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/aplo-error.log",
      out_file: "./logs/aplo-out.log",
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      // Restart policy
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
    },
  ],
};
