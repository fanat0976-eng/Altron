import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), "test-auth-data");

describe("Auth Module", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should generate 32-char hex token", async () => {
    const { loadOrCreateToken, getAuthToken } = await import("../src/auth/index.js");
    const auth = loadOrCreateToken(TEST_DIR);
    expect(auth.token).toMatch(/^[0-9a-f]{32}$/);
    expect(auth.createdAt).toBeDefined();
    expect(getAuthToken()).toBe(auth.token);
  });

  it("should save token to file", async () => {
    const { loadOrCreateToken } = await import("../src/auth/index.js");
    loadOrCreateToken(TEST_DIR);
    expect(existsSync(join(TEST_DIR, "auth.json"))).toBe(true);
  });

  it("should read existing token on reload", async () => {
    const { loadOrCreateToken } = await import("../src/auth/index.js");
    const first = loadOrCreateToken(TEST_DIR);
    const second = loadOrCreateToken(TEST_DIR);
    expect(second.token).toBe(first.token);
  });

  it("should validate correct token", async () => {
    const { loadOrCreateToken, getAuthToken, validateToken } = await import("../src/auth/index.js");
    loadOrCreateToken(TEST_DIR);
    expect(validateToken(getAuthToken())).toBe(true);
  });

  it("should reject wrong token", async () => {
    const { loadOrCreateToken, validateToken } = await import("../src/auth/index.js");
    loadOrCreateToken(TEST_DIR);
    expect(validateToken("wrong-token")).toBe(false);
  });

  it("should reject undefined token", async () => {
    const { loadOrCreateToken, validateToken } = await import("../src/auth/index.js");
    loadOrCreateToken(TEST_DIR);
    expect(validateToken(undefined)).toBe(false);
  });

  it("should return external IP", async () => {
    const { getExternalIP } = await import("../src/auth/index.js");
    const ip = getExternalIP();
    expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("should return server URL", async () => {
    const { getServerUrl } = await import("../src/auth/index.js");
    const url = getServerUrl(3000);
    expect(url).toContain("3000");
    expect(url).toMatch(/^http:\/\//);
  });

  it("should generate QR buffer", async () => {
    const { generateQRBuffer } = await import("../src/auth/index.js");
    const buf = await generateQRBuffer("http://192.168.1.1:3000?token=test123");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4E);
    expect(buf[3]).toBe(0x47);
  });

  it("should return auth info", async () => {
    const { loadOrCreateToken, getAuthInfo } = await import("../src/auth/index.js");
    loadOrCreateToken(TEST_DIR);
    const info = getAuthInfo(3000);
    expect(info.token).toBeDefined();
    expect(info.serverUrl).toContain("3000");
    expect(info.connectUrl).toContain("token=");
    expect(info.externalIP).toBeDefined();
  });

  it("should persist token across processes", async () => {
    const { loadOrCreateToken, getAuthToken } = await import("../src/auth/index.js");
    loadOrCreateToken(TEST_DIR);
    const savedToken = getAuthToken();

    const raw = readFileSync(join(TEST_DIR, "auth.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.token).toBe(savedToken);
  });
});
