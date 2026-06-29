import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { validateToken } from "../auth/index.js";

export interface WSClient {
  ws: WebSocket;
  sessionId?: string;
}

export interface GatewayOptions {
  host: string;
  port: number;
  app?: express.Application;
}

export type WSMessageHandler = (clientId: string, msg: any) => Promise<void>;

export class Gateway {
  private app: express.Application;
  private server: Server;
  private wss: WebSocketServer;
  private clients = new Map<string, WSClient>();
  private messageHandler: WSMessageHandler;

  constructor(options: GatewayOptions, messageHandler: WSMessageHandler) {
    this.messageHandler = messageHandler;
    this.app = options.app || express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server, path: "/ws" });

    this.setupWebSocket();
  }

  get expressApp(): express.Application {
    return this.app;
  }

  get httpServer(): Server {
    return this.server;
  }

  broadcast(data: Record<string, unknown>): void {
    const msg = JSON.stringify(data);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }

  sendToClient(clientId: string, data: Record<string, unknown>): void {
    const client = this.clients.get(clientId);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  listen(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.on("error", reject);
      this.server.listen(port, host, () => resolve());
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of this.clients.values()) {
        client.ws.close();
      }
      this.server.close(() => resolve());
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const token = url.searchParams.get("token") || undefined;

      if (!validateToken(token)) {
        console.warn(`[WS] Unauthorized connection attempt`);
        ws.close(4001, "Unauthorized");
        return;
      }

      const clientId = randomUUID();
      this.clients.set(clientId, { ws });
      console.log(`[WS] Client connected: ${clientId}`);

      ws.send(JSON.stringify({ type: "connected", clientId }));

      ws.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          await this.messageHandler(clientId, msg);
        } catch (err) {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "error", message: (err as Error).message }));
            }
          } catch {}
        }
      });

      ws.on("error", (err) => {
        console.warn(`[WS] Client error ${clientId}:`, err.message);
      });

      ws.on("close", () => {
        this.clients.delete(clientId);
        console.log(`[WS] Client disconnected: ${clientId}`);
      });
    });
  }
}
