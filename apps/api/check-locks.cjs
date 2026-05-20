const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
client.connect().then(() => {
  return client.query('SELECT * FROM pg_stat_activity');
}).then(res => {
  console.log(res.rows.map(r => r.query));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
