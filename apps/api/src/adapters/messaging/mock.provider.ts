import { MessagingProvider, ListSection } from './provider.interface.js';

// Mock provider for local development. Ensures no real WhatsApp messages are sent.
export class MockMessagingProvider implements MessagingProvider {
  async sendMessage(to: string, payload: any) {
    console.log(`\n💬 [MOCK OUTBOUND to ${to}]:`, JSON.stringify(payload, null, 2), '\n');
  }

  async sendLocationRequest(to: string, text: string): Promise<void> {
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text }
      }
    });
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
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
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

  async sendCTAButton(to: string, body: string, buttonText: string, url: string): Promise<void> {
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

  async sendFlowMessage(to: string, headerText: string, bodyText: string, buttonText: string, flowToken: string): Promise<void> {
    console.log(`[MockProvider] Flow Message to ${to}: [Header: ${headerText}] [Body: ${bodyText}] [CTA: ${buttonText}] [Token: ${flowToken}]`);
  }
}
