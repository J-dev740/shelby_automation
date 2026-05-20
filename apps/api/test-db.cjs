const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', connectionTimeoutMillis: 2000 });
pool.query('SELECT 1 as val').then(() => {
  console.log('Connected!');
  process.exit(0);
}).catch(e => {
  console.error('Connection failed!', e);
  process.exit(1);
});
