import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatConversation, ChatHistory, ChatMessage } from '../types';
import { createConversation, createUniqueId, loadChatHistory, saveChatHistory } from '../services/chatHistory';

const DEFAULT_TITLE = 'New chat';
const MAX_TITLE_LENGTH = 60;

function createInitialHistory(): ChatHistory {
  const saved = loadChatHistory();
  if (saved) return saved;
  const conversation = createConversation();
  return {
    version: 1,
    activeConversationId: conversation.id,
    conversations: [conversation],
  };
}

function titleFromQuestion(question: string): string {
  const normalized = question.trim().replace(/\s+/g, ' ');
  return normalized.length > MAX_TITLE_LENGTH
    ? `${normalized.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`
    : normalized;
}

export default function useChatHistory() {
  const [history, setHistory] = useState<ChatHistory>(createInitialHistory);
  const historyRef = useRef(history);
  const activeConversation = useMemo(
    () => history.conversations.find(conversation => conversation.id === history.activeConversationId) ?? null,
    [history]
  );
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    if (!loadChatHistory()) saveChatHistory(historyRef.current);
  }, []);

  const commitHistory = useCallback((update: (current: ChatHistory) => ChatHistory): boolean => {
    const current = historyRef.current;
    const next = update(current);
    if (next === current || !saveChatHistory(next)) return false;
    historyRef.current = next;
    setHistory(next);
    return true;
  }, []);

  const selectConversation = useCallback((conversationId: string) => {
    commitHistory(current => current.activeConversationId === conversationId ||
      !current.conversations.some(conversation => conversation.id === conversationId)
      ? current
      : { ...current, activeConversationId: conversationId });
  }, [commitHistory]);

  const startNewConversation = useCallback(() => {
    commitHistory(current => {
      const currentConversation = current.conversations.find(
        conversation => conversation.id === current.activeConversationId
      );
      if (currentConversation && currentConversation.messages.length === 0) return current;

      const conversation = createConversation(current.conversations.map(item => item.id));
      return {
        ...current,
        activeConversationId: conversation.id,
        conversations: [conversation, ...current.conversations],
      };
    });
  }, [commitHistory]);

  const addMessage = useCallback((conversationId: string, message: Omit<ChatMessage, 'id'>) => {
    commitHistory(current => {
      const target = current.conversations.find(conversation => conversation.id === conversationId);
      if (!target) return current;

      const completeMessage: ChatMessage = {
        ...message,
        id: createUniqueId('message', target.messages.map(item => item.id)),
      };
      const messages = [...target.messages, completeMessage];
      const firstQuestion = messages.find(item => item.role === 'user')?.content;
      const updatedConversation: ChatConversation = {
        ...target,
        title: firstQuestion ? titleFromQuestion(firstQuestion) : DEFAULT_TITLE,
        updatedAt: new Date(),
        messages,
      };
      return {
        ...current,
        conversations: [
          updatedConversation,
          ...current.conversations.filter(conversation => conversation.id !== conversationId),
        ],
      };
    });
  }, [commitHistory]);

  const deleteConversation = useCallback((conversationId: string) => {
    return commitHistory(current => {
      const conversations = current.conversations.filter(conversation => conversation.id !== conversationId);
      if (conversations.length === current.conversations.length) return current;

      const remainingConversations = conversations.length > 0
        ? conversations
        : [createConversation(current.conversations.map(conversation => conversation.id))];
      const activeConversationStillExists = remainingConversations.some(
        conversation => conversation.id === current.activeConversationId
      );
      const mostRecentlyUpdated = remainingConversations.reduce((latest, conversation) =>
        conversation.updatedAt.getTime() > latest.updatedAt.getTime() ? conversation : latest
      );

      return {
        ...current,
        activeConversationId: activeConversationStillExists
          ? current.activeConversationId
          : mostRecentlyUpdated.id,
        conversations: remainingConversations,
      };
    });
  }, [commitHistory]);

  return {
    history,
    activeConversation,
    messages,
    selectConversation,
    startNewConversation,
    addMessage,
    deleteConversation,
  };
}
