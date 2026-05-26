import { MessagingProvider, ListSection } from './provider.interface.js';
import { enqueueOutboundMessage } from '../../services/outbound-queue.service.js';

export class QueueMessagingProvider implements MessagingProvider {
  async sendMessage(to: string, payload: any): Promise<void> {
    await enqueueOutboundMessage(to, 'sendMessage', payload);
  }

  async sendText(to: string, text: string): Promise<void> {
    await enqueueOutboundMessage(to, 'sendText', text);
  }

  async sendInteractiveButtons(to: string, text: string, buttons: {id: string, title: string}[]): Promise<void> {
    await enqueueOutboundMessage(to, 'sendInteractiveButtons', text, buttons);
  }

  async sendListMessage(to: string, body: string, buttonText: string, sections: ListSection[]): Promise<void> {
    await enqueueOutboundMessage(to, 'sendListMessage', body, buttonText, sections);
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    await enqueueOutboundMessage(to, 'sendImage', imageUrl, caption);
  }

  async sendCTAButton(to: string, body: string, buttonText: string, url: string): Promise<void> {
    await enqueueOutboundMessage(to, 'sendCTAButton', body, buttonText, url);
  }

  async sendFlowMessage(to: string, headerText: string, bodyText: string, buttonText: string, flowToken: string): Promise<void> {
    await enqueueOutboundMessage(to, 'sendFlowMessage', headerText, bodyText, buttonText, flowToken);
  }
}
