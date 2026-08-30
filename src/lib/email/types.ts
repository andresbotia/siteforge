export type SendEmailInput = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  metadata?: Record<string, string>;
};

export type SendEmailResult = {
  ok: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  simulated?: boolean;
};

export interface EmailProvider {
  readonly id: string;
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}
