export interface ListSection {
  title: string;
  rows: { id: string; title: string; description?: string }[];
}

export interface MessagingProvider {
  sendMessage(to: string, payload: any): Promise<void>;
  sendText(to: string, text: string): Promise<void>;
  sendInteractiveButtons(to: string, text: string, buttons: {id: string, title: string}[]): Promise<void>;
  sendListMessage(to: string, body: string, buttonText: string, sections: ListSection[]): Promise<void>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<void>;
  sendCTAButton(to: string, body: string, buttonText: string, url: string): Promise<void>;
  /**
   * Sends an interactive WhatsApp Flow message
   */
  sendFlowMessage(to: string, headerText: string, bodyText: string, buttonText: string, flowToken: string): Promise<void>;
}
