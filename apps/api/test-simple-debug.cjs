console.log('1. Loading pg module...');
const pg = require('pg');
console.log('2. pg module loaded. Creating Pool...');
const pool = new pg.Pool({ 
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable', 
  connectionTimeoutMillis: 2000 
});
console.log('3. Pool created. Running query...');
pool.query('SELECT 1').then(() => {
  console.log('4. Query completed successfully!');
  process.exit(0);
}).catch(e => {
  console.error('Connection/Query failed:', e);
  process.exit(1);
});
