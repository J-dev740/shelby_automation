import { MessagingProvider } from './provider.interface.js';

// Mock provider for local development. Ensures no real WhatsApp messages are sent.
export class MockMessagingProvider implements MessagingProvider {
  async sendMessage(to: string, payload: any) {
    console.log(`\n💬 [MOCK OUTBOUND to ${to}]:`, JSON.stringify(payload, null, 2), '\n');
  }

  async sendText(to: string, text: string) {
    return this.sendMessage(to, { type: 'text', text: { body: text } });
  }

  async sendInteractiveButtons(to: string, text: string, buttons: {id: string, title: string}[]) {
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: {
          buttons: buttons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title }
          }))
        }
      }
    });
  }
}
