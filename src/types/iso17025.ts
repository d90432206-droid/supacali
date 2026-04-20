export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  avatar: string;
  color: string;
  systemPrompt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId?: string;
  timestamp: number;
}
