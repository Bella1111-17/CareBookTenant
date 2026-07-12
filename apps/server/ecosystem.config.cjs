module.exports = {
  apps: [
    {
      name: 'carebook_tob_api',
      namespace: 'carebook_tob',
      max_memory_restart: '1024M',
      user: 'www',
      exec_mode: 'fork',
      cwd: '/www/wwwroot/tenant-api.care.zbcare.cn',
      script: 'dist/main.js',
      args: '',
      watch: false,
      out_file: '/www/wwwlogs/pm2/carebook_tob_api/out.log',
      error_file: '/www/wwwlogs/pm2/carebook_tob_api/err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
