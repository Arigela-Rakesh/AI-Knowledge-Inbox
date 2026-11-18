import { z } from 'zod';

export const ingestNoteSchema = z.object({
  type: z.literal('note'),
  title: z.string().min(1, 'Title is required').max(500),
  content: z.string().min(1, 'Content is required').max(100000),
});

export const ingestUrlSchema = z.object({
  type: z.literal('url'),
  url: z.string().url('Must be a valid URL'),
  title: z.string().max(500).optional(),
});

export const ingestSchema = z.discriminatedUnion('type', [ingestNoteSchema, ingestUrlSchema]);

export const querySchema = z.object({
  question: z.string().min(1, 'Question is required').max(2000),
});
