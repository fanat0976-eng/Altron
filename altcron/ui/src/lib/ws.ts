export type WSMessage =
  | { type: "connected"; clientId: string }
  | { type: "pong" }
  | { type: "stream_start"; sessionId: string }
  | { type: "stream_chunk"; content: string; done: boolean; provider: string; model: string }
  | { type: "stream_end"; sessionId: string }
  | { type: "agent_start"; sessionId: string }
  | { type: "agent_result"; sessionId: string; response: string; steps?: any[]; plan?: any }
  | { type: "tool_result"; toolName: string; result: any }
  | { type: "tools_list"; tools: any[] }
  | { type: "agent_memory_result"; action: string; entries?: any[]; entry?: any; deleted?: boolean }
  | { type: "error"; message: string }
  | { type: "session_created"; session: any };

type MessageHandler = (msg: WSMessage) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.intentionalClose = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[WS] Connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        this.handlers.forEach((h) => h(msg));
      } catch (e) {
        console.error("[WS] Failed to parse message:", e);
      }
    };

    this.ws.onclose = () => {
      if (this.intentionalClose) return;
      console.log("[WS] Disconnected, reconnecting in 3s...");
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn("[WS] Cannot send, connection not open. Message:", msg.type);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

const WS_PORT = 3000;
const WS_URL = `ws://localhost:${WS_PORT}/ws`;

export const wsClient = new WSClient(WS_URL);
