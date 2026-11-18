import { ChatConversation, ChatHistory, ChatMessage, SourceCitation } from '../types';

const STORAGE_KEY = 'ai-knowledge-inbox:chat-history:v1';
const STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseSourceCitation(value: unknown): SourceCitation | null {
  if (!isRecord(value)) return null;
  const { itemId, chunkId, title, url, snippet, similarity } = value;
  if (
    typeof itemId !== 'string' ||
    (chunkId !== undefined && typeof chunkId !== 'string') ||
    typeof title !== 'string' ||
    (url !== null && typeof url !== 'string') ||
    typeof snippet !== 'string' ||
    (similarity !== undefined &&
      (typeof similarity !== 'number' || !Number.isFinite(similarity)))
  ) {
    return null;
  }
  return {
    itemId,
    ...(typeof chunkId === 'string' ? { chunkId } : {}),
    title,
    url,
    snippet,
    ...(typeof similarity === 'number' ? { similarity } : {}),
  };
}

function parseMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  const { id, role, content, timestamp, sources } = value;
  const parsedTimestamp = parseDate(timestamp);
  if (
    typeof id !== 'string' ||
    (role !== 'user' && role !== 'assistant') ||
    typeof content !== 'string' ||
    !parsedTimestamp
  ) {
    return null;
  }
  const parsedSources = Array.isArray(sources)
    ? sources.map(parseSourceCitation).filter((source): source is SourceCitation => source !== null)
    : undefined;
  return {
    id,
    role,
    content,
    timestamp: parsedTimestamp,
    ...(parsedSources ? { sources: parsedSources } : {}),
  };
}

function parseConversation(value: unknown): ChatConversation | null {
  if (!isRecord(value)) return null;
  const { id, title, createdAt, updatedAt, messages } = value;
  const parsedCreatedAt = parseDate(createdAt);
  const parsedUpdatedAt = parseDate(updatedAt);
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    !parsedCreatedAt ||
    !parsedUpdatedAt ||
    !Array.isArray(messages)
  ) {
    return null;
  }
  return {
    id,
    title,
    createdAt: parsedCreatedAt,
    updatedAt: parsedUpdatedAt,
    messages: messages.map(parseMessage).filter((message): message is ChatMessage => message !== null),
  };
}

export function loadChatHistory(): ChatHistory | null {
  if (typeof window === 'undefined') return null;
  let serialized: string | null;
  try {
    serialized = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to read chat history from localStorage.', error);
    return null;
  }
  if (serialized === null) return null;

  try {
    const stored: unknown = JSON.parse(serialized);
    if (!isRecord(stored) || stored.version !== STORAGE_VERSION || !Array.isArray(stored.conversations)) {
      throw new Error('Stored chat history has an unsupported format.');
    }

    const conversations = stored.conversations
      .map(parseConversation)
      .filter((conversation): conversation is ChatConversation => conversation !== null);
    if (conversations.length === 0) return null;

    const activeConversationId =
      typeof stored.activeConversationId === 'string' &&
      conversations.some(conversation => conversation.id === stored.activeConversationId)
        ? stored.activeConversationId
        : conversations[0].id;

    return { version: STORAGE_VERSION, activeConversationId, conversations };
  } catch (error) {
    console.warn('Stored chat history is invalid and will be ignored.', error);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (removeError) {
      console.warn('Unable to remove invalid chat history from localStorage.', removeError);
    }
    return null;
  }
}

export function saveChatHistory(history: ChatHistory): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    console.warn('Unable to save chat history to localStorage.', error);
    return false;
  }
}

export function createUniqueId(prefix: string, existingIds: string[] = []): string {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let id = `${prefix}-${randomId}`;
  while (existingIds.includes(id)) {
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return id;
}

export function createConversation(existingIds: string[] = []): ChatConversation {
  const now = new Date();
  return {
    id: createUniqueId('conversation', existingIds),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}
