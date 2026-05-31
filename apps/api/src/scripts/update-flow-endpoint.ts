import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const API_VERSION = process.env.META_API_VERSION || 'v25.0';
const ACCESS_TOKEN = process.env.META_API_TOKEN;
const FLOW_ID = process.env.FLOW_ID;

async function updateEndpoint() {
  const newEndpoint = process.argv[2];

  if (!newEndpoint) {
    console.error('Usage: npx tsx src/scripts/update-flow-endpoint.ts <YOUR_RAILWAY_URL>');
    console.error('Example: npx tsx src/scripts/update-flow-endpoint.ts https://shelby-api-production.up.railway.app/flows/data');
    process.exit(1);
  }

  if (!ACCESS_TOKEN || !FLOW_ID) {
    throw new Error('Missing META_API_TOKEN or FLOW_ID in .env');
  }

  console.log(`Updating Flow ${FLOW_ID} endpoint to: ${newEndpoint}`);

  const endpointBody = new URLSearchParams();
  endpointBody.append('endpoint_uri', newEndpoint);
  endpointBody.append('application_type', 'WEBHOOK');

  const endpointRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${FLOW_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: endpointBody.toString()
  });

  const responseText = await endpointRes.text();
  if (!endpointRes.ok) {
    console.error('Failed to update endpoint:', responseText);
    process.exit(1);
  }

  console.log('✅ Endpoint updated successfully! Response:', responseText);
}

updateEndpoint().catch(console.error);
