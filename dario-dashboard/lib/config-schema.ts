import { z } from "zod";

/**
 * Zod mirror of dario's DarioConfig (src/config-file.ts, schema v1). Only
 * the fields the editor surfaces are typed strictly; unknown keys pass
 * through untouched via `.passthrough()` so we never drop config dario
 * understands but this UI doesn't yet.
 */
export const CONFIG_SCHEMA_VERSION = 1;

const nullableInt = z.number().int().nullable().optional();

export const darioConfigSchema = z
  .object({
    version: z.number().int().default(CONFIG_SCHEMA_VERSION),

    // Server
    port: z.number().int().min(1).max(65535).optional(),
    host: z.string().optional(),

    // Routing / translation
    model: z.string().nullable().optional(),
    passthrough: z.boolean().optional(),
    preserveTools: z.boolean().optional(),
    hybridTools: z.boolean().optional(),
    mergeTools: z.boolean().optional(),
    noAutoDetect: z.boolean().optional(),

    // Wire fidelity
    strictTls: z.boolean().optional(),
    strictTemplate: z.boolean().optional(),
    noLiveCapture: z.boolean().optional(),
    drainOnClose: z.boolean().optional(),

    // Stealth / pacing
    stealth: z.boolean().optional(),
    pacing: z
      .object({ minMs: z.number().optional(), jitterMs: z.number().optional() })
      .passthrough()
      .optional(),
    thinkTime: z
      .object({
        baseMs: z.number().optional(),
        perTokenMs: z.number().optional(),
        jitterMs: z.number().optional(),
        maxMs: z.number().optional(),
      })
      .passthrough()
      .optional(),
    sessionStart: z
      .object({ minMs: z.number().optional(), jitterMs: z.number().optional() })
      .passthrough()
      .optional(),

    // Sessions
    session: z
      .object({
        idleRotateMs: z.number().optional(),
        rotateJitterMs: z.number().optional(),
        maxAgeMs: z.number().nullable().optional(),
        perClient: z.boolean().optional(),
      })
      .passthrough()
      .optional(),

    // Queue
    queue: z
      .object({
        maxConcurrent: nullableInt,
        maxQueued: nullableInt,
        timeoutMs: nullableInt,
      })
      .passthrough()
      .optional(),

    // Tokens / betas / prompt
    effort: z.string().nullable().optional(),
    maxTokens: z.union([z.number().int(), z.literal("client")]).nullable().optional(),
    passthroughBetas: z.array(z.string()).optional(),
    systemPrompt: z.string().nullable().optional(),
    preserveOrchestrationTags: z.boolean().optional(),
    logFile: z.string().nullable().optional(),

    // Overage guard
    overageGuard: z
      .object({
        enabled: z.boolean().optional(),
        behavior: z.enum(["halt", "warn"]).optional(),
        cooldownMs: z.number().optional(),
        notifyOs: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type DarioConfig = z.infer<typeof darioConfigSchema>;
