/**
 * Direct read/write of dario's ~/.dario/config.json (deployment plan A:
 * dashboard runs on the same machine as the proxy). Mirrors dario's own
 * atomic write — temp file in the same dir, 0o600, rename into place — so a
 * crash mid-write can't truncate a live config. dario does NOT export these
 * from its package, so we reimplement the contract here rather than import.
 */
import "server-only";
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import {
  darioConfigSchema,
  CONFIG_SCHEMA_VERSION,
  type DarioConfig,
} from "./config-schema";

export function configPath(): string {
  return process.env.DARIO_CONFIG_PATH || join(homedir(), ".dario", "config.json");
}

export interface ConfigReadResult {
  path: string;
  exists: boolean;
  config: DarioConfig;
}

/** Read + validate the config. A missing file yields a minimal default. */
export function readConfig(): ConfigReadResult {
  const path = configPath();
  if (!existsSync(path)) {
    return { path, exists: false, config: { version: CONFIG_SCHEMA_VERSION } };
  }
  const raw = readFileSync(path, "utf-8");
  const parsed = darioConfigSchema.parse(JSON.parse(raw));
  return { path, exists: true, config: parsed };
}

/**
 * Validate then atomically write. Returns the validated config that landed
 * on disk. Throws ZodError on a bad shape (the caller maps it to a 422).
 */
export function writeConfig(input: unknown): DarioConfig {
  const config = darioConfigSchema.parse(input);
  if (config.version == null) config.version = CONFIG_SCHEMA_VERSION;

  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  const json = JSON.stringify(config, null, 2) + "\n";
  writeFileSync(tmp, json, { mode: 0o600 });
  renameSync(tmp, path);
  return config;
}
