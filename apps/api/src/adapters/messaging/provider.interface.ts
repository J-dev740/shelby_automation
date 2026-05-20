export interface MessagingProvider {
  sendMessage(to: string, payload: any): Promise<void>;
  sendText(to: string, text: string): Promise<void>;
  sendInteractiveButtons(to: string, text: string, buttons: {id: string, title: string}[]): Promise<void>;
}
