const net = require('net');
console.log('Connecting...');
const client = net.connect({ port: 54322, host: '127.0.0.1' }, () => {
  console.log('Connected to port 54322');
  client.end();
  process.exit(0);
});
client.on('error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
});
