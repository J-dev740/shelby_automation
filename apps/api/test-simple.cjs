const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable', connectionTimeoutMillis: 2000 });
pool.query('SELECT 1').then(() => {
  console.log('Connected to localhost!');
  process.exit(0);
}).catch(e => {
  console.error('Localhost failed', e);
  process.exit(1);
});
