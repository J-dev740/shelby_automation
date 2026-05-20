const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', connectionTimeoutMillis: 2000 });
client.on('error', (err) => console.error('Client error', err));
client.connect().then(() => {
  console.log('Connected!');
  return client.query('SELECT 1 as val');
}).then(res => {
  console.log('Query result:', res.rows);
  process.exit(0);
}).catch(e => {
  console.error('Connection failed!', e);
  process.exit(1);
});
