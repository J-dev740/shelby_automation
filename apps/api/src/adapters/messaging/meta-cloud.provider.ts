import { MessagingProvider } from './provider.interface.js';

// Production-ready adapter that speaks the Meta API contract.
// This EXACT file will be used in Phase 1 production.
export class MetaCloudProvider implements MessagingProvider {
  constructor(
    private token: string,
    private phoneId: string,
    private apiVersion: string = 'v25.0'
  ) {}

  async sendMessage(to: string, payload: any) {
    if (!this.token || !this.phoneId) {
      console.log(`\n💬 [MOCK OUTBOUND to ${to}]:`, JSON.stringify(payload, null, 2), '\n');
      return;
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneId}/messages`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
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
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Meta API Error]', response.status, error);
        // ROLLBACK: Print to terminal so message is never silently lost
        console.log(`\n💬 [ROLLBACK TO TERMINAL — Meta API ${response.status} for ${to}]:`, JSON.stringify(payload, null, 2), '\n');
      }
    } catch (err: any) {
      console.error('[Meta API Network Error]', err.message);
      // ROLLBACK: Print to terminal
      console.log(`\n💬 [ROLLBACK TO TERMINAL — Network error for ${to}]:`, JSON.stringify(payload, null, 2), '\n');
    } finally {
      clearTimeout(timeout);
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
