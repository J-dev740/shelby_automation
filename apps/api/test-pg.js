import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', connectionTimeoutMillis: 2000 });
console.log("Connecting...");
pool.query('SELECT 1').then(() => {
  console.log("Connected!");
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
