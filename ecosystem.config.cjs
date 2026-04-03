module.exports = {
  apps: [
    {
      name: "reagent",
      cwd: __dirname,
      script: "dist/server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      min_uptime: "10s",
      max_restarts: 20,
      restart_delay: 5000,
      kill_timeout: 10000,
      watch: false,
      merge_logs: true,
      out_file: ".reagent-pm2.out.log",
      error_file: ".reagent-pm2.err.log",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
      },
    },
  ],
};
