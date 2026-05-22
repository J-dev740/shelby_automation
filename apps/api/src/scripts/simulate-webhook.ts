/**
 * Helper script to simulate incoming WhatsApp webhooks locally.
 * This is useful for testing the FSM without a real Meta webhook connection.
 */

const API_URL = 'http://localhost:3000/webhook/meta';
const PHONE_NUMBER = '1234567890'; // Mock sender phone number

async function sendMessage(text: string) {
  console.log(`\n🗣️  Sending: "${text}"`);
  
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'mock-account-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '0987654321',
                phone_number_id: 'mock-phone-id'
              },
              contacts: [{ profile: { name: 'Test User' }, wa_id: PHONE_NUMBER }],
              messages: [
                {
                  from: PHONE_NUMBER,
                  id: `wamid.mock-${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: text },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to send message. Status: ${response.status}`);
    } else {
      console.log('✅ Webhook accepted by API');
    }
  } catch (error) {
    console.error('❌ Could not connect to API. Is it running? (pnpm dev)');
  }
}

// Interactive prompt setup
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=============================================');
console.log('🧪 Shelby Local Webhook Simulator');
console.log('Type a message and press Enter to simulate an incoming WhatsApp message.');
console.log('Type "exit" to quit.');
console.log('=============================================\n');

function prompt() {
  rl.question('> ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    
    // Support interactive payloads via simple slash commands
    // e.g. /button btn_coffee
    // e.g. /list cat_123
    if (input.startsWith('/button ')) {
      const btnId = input.replace('/button ', '').trim();
      await sendButton(btnId);
    } else if (input.startsWith('/list ')) {
      const listId = input.replace('/list ', '').trim();
      await sendListReply(listId);
    } else {
      await sendMessage(input);
    }
    
    // Wait a brief moment before prompting again to let console logs settle
    setTimeout(prompt, 500);
  });
}

async function sendButton(buttonId: string) {
  console.log(`\n👆 Clicking Button: "${buttonId}"`);
  
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'mock-account-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '0987654321',
                phone_number_id: 'mock-phone-id'
              },
              contacts: [{ profile: { name: 'Test User' }, wa_id: PHONE_NUMBER }],
              messages: [
                {
                  from: PHONE_NUMBER,
                  id: `wamid.mock-${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: {
                      id: buttonId,
                      title: 'Mock Button Title'
                    }
                  }
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('✅ Button webhook accepted by API');
  } catch (error) {
    console.error('❌ Could not connect to API.');
  }
}

async function sendListReply(listId: string) {
  console.log(`\n👆 Selecting List Row: "${listId}"`);
  
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'mock-account-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '0987654321',
                phone_number_id: 'mock-phone-id'
              },
              contacts: [{ profile: { name: 'Test User' }, wa_id: PHONE_NUMBER }],
              messages: [
                {
                  from: PHONE_NUMBER,
                  id: `wamid.mock-${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'interactive',
                  interactive: {
                    type: 'list_reply',
                    list_reply: {
                      id: listId,
                      title: 'Mock Row Title'
                    }
                  }
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('✅ List reply webhook accepted by API');
  } catch (error) {
    console.error('❌ Could not connect to API.');
  }
}

// Start prompt
prompt();
