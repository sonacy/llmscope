import { z } from 'zod';

export const TransportSchema = z.enum(['http', 'sse', 'ws']);
export type Transport = z.infer<typeof TransportSchema>;

export const ProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'bedrock',
  'cohere',
  'mistral',
  'together',
  'groq',
  'openrouter',
  'unknown',
]);
export type Provider = z.infer<typeof ProviderSchema>;

export const HeadersSchema = z.record(z.string(), z.string());
export type Headers = z.infer<typeof HeadersSchema>;

export const UsageSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  })
  .strict();
export type Usage = z.infer<typeof UsageSchema>;

export const IngestHintSchema = z
  .object({
    provider: ProviderSchema.optional(),
    model: z.string().optional(),
    source_kind: z.string().optional(),
    source_label: z.string().optional(),
  })
  .strict();
export type IngestHint = z.infer<typeof IngestHintSchema>;

export const ReassembledSchema = z
  .object({
    chunks: z.number().int().nonnegative().optional(),
    first_byte_ms: z.number().int().nonnegative().optional(),
    usage: UsageSchema.optional(),
  })
  .strict();
export type Reassembled = z.infer<typeof ReassembledSchema>;

export const IngestEventSchema = z
  .object({
    ts_start: z.number().int().nonnegative(),
    ts_end: z.number().int().nonnegative(),
    transport: TransportSchema,
    method: z.string().min(1),
    url: z.string().url(),
    request_headers: HeadersSchema,
    request_body: z.string().nullable(),
    status: z.number().int().nullable(),
    response_headers: HeadersSchema,
    response_body: z.string().nullable(),
    error: z.string().nullable().optional(),
    hint: IngestHintSchema.optional(),
    request_body_truncated: z.boolean().optional(),
    response_body_truncated: z.boolean().optional(),
    reassembled: ReassembledSchema.optional(),
  })
  .strict();
export type IngestEvent = z.infer<typeof IngestEventSchema>;

export const SourceSchema = z
  .object({
    kind: z.string(),
    label: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type Source = z.infer<typeof SourceSchema>;
