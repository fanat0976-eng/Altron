import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { randomBytes } from "crypto";
import os from "os";
import QRCode from "qrcode";

export interface AuthData {
  token: string;
  createdAt: string;
}

let authData: AuthData | null = null;
let authPath = "./data/auth.json";

export function loadOrCreateToken(dataDir = "./data"): AuthData {
  authPath = join(dataDir, "auth.json");
  if (!existsSync(dirname(authPath))) {
    mkdirSync(dirname(authPath), { recursive: true });
  }

  if (existsSync(authPath)) {
    try {
      const raw = readFileSync(authPath, "utf-8");
      authData = JSON.parse(raw);
      console.log(`[Auth] Token loaded from ${authPath}`);
      return authData!;
    } catch {
      console.warn("[Auth] Corrupted auth.json, regenerating");
    }
  }

  const token = randomBytes(16).toString("hex");
  authData = { token, createdAt: new Date().toISOString() };
  writeFileSync(authPath, JSON.stringify(authData, null, 2), "utf-8");
  console.log(`[Auth] New token generated: ${authPath}`);
  return authData;
}

export function getAuthToken(): string {
  if (!authData) throw new Error("Auth not initialized. Call loadOrCreateToken() first.");
  return authData.token;
}

export function validateToken(token: string | undefined): boolean {
  if (!token || !authData) return false;
  return token === authData.token;
}

export function getExternalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

export function getServerUrl(port: number): string {
  const ip = getExternalIP();
  return `http://${ip}:${port}`;
}

export async function generateQRBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", width: 256, margin: 2 });
}

export async function printQRToConsole(url: string): Promise<void> {
  const qrt = await import("qrcode-terminal");
  qrt.generate(url, { small: true }, (qr: string) => {
    console.log("\n[QR] Scan to connect:");
    console.log(qr);
    console.log(`[QR] URL: ${url}\n`);
  });
}

export function getAuthInfo(port: number) {
  const ip = getExternalIP();
  const url = getServerUrl(port);
  const token = getAuthToken();
  return {
    token,
    serverUrl: url,
    connectUrl: `${url}?token=${token}`,
    externalIP: ip,
  };
}
