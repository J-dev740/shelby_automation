import { MessagingProvider } from './provider.interface.js';

// Production-ready adapter that speaks the Meta API contract.
// This EXACT file will be used in Phase 1 production.
export class MetaCloudProvider implements MessagingProvider {
  constructor(private token: string, private phoneId: string) {}

  async sendMessage(to: string, payload: any) {
    // If no tokens are provided, just log to terminal (useful for local dev without a phone)
    if (!this.token || !this.phoneId) {
      console.log(`\n💬 [MOCK OUTBOUND to ${to}]:`, JSON.stringify(payload, null, 2), '\n');
      return;
    }

    const url = `https://graph.facebook.com/v18.0/${this.phoneId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        ...payload
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Meta API Error]', error);
    }
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
