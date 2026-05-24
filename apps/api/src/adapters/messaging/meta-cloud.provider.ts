import { MessagingProvider, ListSection } from './provider.interface.js';
import { metaApiCircuitBreaker } from '../../lib/circuit-breaker.js';

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
    
    try {
      await metaApiCircuitBreaker.fire(async () => {
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
            const errorBody = await response.text();
            console.error(`[Meta API Error] method=${payload.type} status=${response.status} body=${errorBody}`);
            throw new Error(`Meta API Error: ${response.status} ${errorBody}`);
          } else {
            const respJson = await response.json() as any;
            console.log(`[Meta API OK] method=${payload.type} msgId=${respJson?.messages?.[0]?.id ?? 'n/a'}`);
          }
        } finally {
          clearTimeout(timeout);
        }
      });
    } catch (err: any) {
      console.error('[Meta API/CircuitBreaker Error]', err.message);
      // ROLLBACK: Print to terminal
      console.log(`\n💬 [ROLLBACK TO TERMINAL — Failed to send to ${to}]:`, JSON.stringify(payload, null, 2), '\n');
      throw err; // Re-throw so Outbound Queue can retry
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

  async sendListMessage(to: string, body: string, buttonText: string, sections: ListSection[]) {
    // Meta REQUIRES a header for list messages — without it the API returns a silent 400
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Shelby ☕' },
        body: { text: body },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    });
  }

  async sendImage(to: string, imageUrl: string, caption?: string) {
    return this.sendMessage(to, {
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption
      }
    });
  }

  async sendCTAButton(to: string, body: string, buttonText: string, url: string) {
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: body },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: buttonText,
            url: url
          }
        }
      }
    });
  }
}
