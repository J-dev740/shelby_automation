import * as dotenv from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import crypto from 'crypto';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const API_VERSION = process.env.META_API_VERSION || 'v25.0';
const WABA_ID = process.env.META_BUSINESS_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.META_API_TOKEN;

async function setupFlow() {
  if (!WABA_ID || !ACCESS_TOKEN) {
    throw new Error('Missing META_BUSINESS_ACCOUNT_ID or META_API_TOKEN in .env');
  }

  console.log('1. Generating RSA 2048-bit Key Pair...');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Save the private key locally
  const keysDir = join(process.cwd(), 'keys');
  try {
    const fs = await import('fs');
    if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir);
  } catch (e) {}
  writeFileSync(join(keysDir, 'flow_private.pem'), privateKey);
  console.log('✅ Private key saved to keys/flow_private.pem');
  
  // WhatsApp requires the full PEM string including headers for whatsapp_business_encryption
  const publicKeyClean = publicKey;

  console.log('2. Creating WhatsApp Flow via Graph API...');
  const createFlowBody = new URLSearchParams();
  createFlowBody.append('name', 'shelby_ordering_flow_' + Date.now());
  createFlowBody.append('categories', '["OTHER"]');

  const createRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${WABA_ID}/flows`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: createFlowBody.toString()
  });

  const createData = await createRes.json();
  if (!createRes.ok || !createData.id) {
    console.error('Failed to create flow:', createData);
    process.exit(1);
  }
  const flowId = createData.id;
  console.log(`✅ Flow created successfully. FLOW_ID = ${flowId}`);

  console.log('3. Updating Flow JSON...');
  // We use FormData for multipart/form-data
  const formData = new FormData();
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');
  
  const flowJsonPath = join(process.cwd(), 'src/flows/shelby-menu-flow.json');
  const flowJsonContent = readFileSync(flowJsonPath, 'utf-8');
  
  // Convert JSON to Blob/File for FormData
  formData.append('file', new Blob([flowJsonContent], { type: 'application/json' }), 'flow.json');

  const updateRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${flowId}/assets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    },
    body: formData
  });

  const updateData = await updateRes.json();
  if (!updateRes.ok || !updateData.success) {
    console.error('Failed to update Flow JSON:', updateData);
    process.exit(1);
  }
  console.log('✅ Flow JSON updated successfully.');

  console.log('4. Uploading Public Key (Data Endpoint setup)...');
  const PHONE_ID = process.env.META_PHONE_ID;
  if (!PHONE_ID) {
    console.error('Missing META_PHONE_ID in .env. Skipping public key upload.');
  } else {
    // A. Upload Public Key to Phone Number
    const keyBody = new URLSearchParams();
    keyBody.append('business_public_key', publicKeyClean);

    const keyRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/whatsapp_business_encryption`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: keyBody.toString()
    });
    
    if (!keyRes.ok) {
      console.log('Key upload response:', await keyRes.text());
    }

    // B. Set Endpoint URI on the Flow
    const endpointBody = new URLSearchParams();
    endpointBody.append('endpoint_uri', 'https://api.shelbyautomation.com/flows/data'); 
    endpointBody.append('application_type', 'WEBHOOK');

    const endpointRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${flowId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: endpointBody.toString()
    });
    
    if (!endpointRes.ok) {
      console.log('Endpoint URI response:', await endpointRes.text());
    } else {
      console.log('✅ Endpoint configured and public key uploaded successfully.');
    }
  }

  console.log('\n=============================================');
  console.log('🎉 SUCCESS! Step 8 Complete.');
  console.log('Please add these to your .env file:');
  console.log(`FLOW_ID=${flowId}`);
  console.log(`FLOW_PRIVATE_KEY_PATH=keys/flow_private.pem`);
  console.log('=============================================');
}

setupFlow().catch(console.error);
