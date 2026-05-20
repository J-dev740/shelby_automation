import pg from 'pg';
const { Client } = pg;
async function t() {
  console.log("Connecting...");
  const c = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
  await c.connect();
  console.log("Connected!");
  
  const tables = ['menu_items', 'modifiers', 'modifier_groups', 'system_settings'];
  for (const table of tables) {
    const res = await c.query(`SELECT count(*) FROM ${table}`);
    console.log(`${table} count:`, res.rows[0].count);
  }
  
  await c.end();
}
t().catch(console.error);
