import { useMemo } from 'react';
import type { PubSubMessage } from '../types';

/**
 * Hook for filtering messages by search query
 * Searches in payload and attributes (keys and values)
 */
export function useMessageSearch(
  messages: PubSubMessage[],
  searchQuery: string
): PubSubMessage[] {
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) {
      return messages;
    }

    const query = searchQuery.toLowerCase();

    return messages.filter((msg) => {
      // Search in payload
      if (msg.data.toLowerCase().includes(query)) {
        return true;
      }

      // Search in attributes (keys and values)
      for (const [key, value] of Object.entries(msg.attributes)) {
        if (
          key.toLowerCase().includes(query) ||
          value.toLowerCase().includes(query)
        ) {
          return true;
        }
      }

      return false;
    });
  }, [messages, searchQuery]);

  return filteredMessages;
}
