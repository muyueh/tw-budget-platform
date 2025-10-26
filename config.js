const config = {
  db: {
    host: 'localhost',
    port: 5432,
    database: 'budget',
    user: 'root',
    password: ''
  },
  salt: 'static-site-salt',
  session_secret: 'static-site-session',
  file_model: true,
  default_view: 'bubble',
  base_path: '/'
};

module.exports = config;
module.exports.default = config;
