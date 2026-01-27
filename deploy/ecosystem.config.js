module.exports = {
  apps: [
    {
      name: 'print-form-backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    }
  ]
};
