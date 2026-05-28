export type Mode = 'landing' | 'chat' | 'live';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}
