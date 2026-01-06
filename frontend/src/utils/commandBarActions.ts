import type { Topic, Subscription } from '../types';

export type CommandBarActionType = 'action' | 'topic' | 'subscription';

export interface CommandBarAction {
  id: string;
  type: CommandBarActionType;
  label: string;
  description?: string;
  keywords: string[]; // Search keywords for fuzzy matching
  icon?: string; // SVG path or icon name
  shortcut?: string; // Keyboard shortcut hint
  execute: () => void;
  enabled?: boolean;
}

/**
 * Simple fuzzy search - matches if query appears in text (case-insensitive)
 * Scores results by match position and length
 */
export const fuzzyMatch = (query: string, text: string): { match: boolean; score: number } => {
  if (!query.trim()) {
    return { match: true, score: 0 };
  }

  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) {
    return { match: true, score: 1000 };
  }

  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) {
    return { match: true, score: 500 };
  }

  // Contains query gets lower score
  const index = lowerText.indexOf(lowerQuery);
  if (index !== -1) {
    // Score decreases based on position (earlier matches are better)
    const positionScore = 100 - index;
    return { match: true, score: positionScore };
  }

  // Check if all characters in query appear in order (fuzzy match)
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }

  if (queryIndex === lowerQuery.length) {
    // All characters found in order - score based on how spread out they are
    return { match: true, score: 10 };
  }

  return { match: false, score: 0 };
};

/**
 * Search actions and resources
 */
export const searchCommandBar = (
  query: string,
  actions: CommandBarAction[],
  topics: Topic[],
  subscriptions: Subscription[]
): CommandBarAction[] => {
  if (!query.trim()) {
    // Return all actions when query is empty (limit to top actions)
    return actions.filter(a => a.type === 'action').slice(0, 10);
  }

  const results: Array<CommandBarAction & { score: number }> = [];

  // Search actions
  for (const action of actions) {
    // Check label
    const labelMatch = fuzzyMatch(query, action.label);
    if (labelMatch.match) {
      results.push({ ...action, score: labelMatch.score });
      continue;
    }

    // Check description
    if (action.description) {
      const descMatch = fuzzyMatch(query, action.description);
      if (descMatch.match) {
        results.push({ ...action, score: descMatch.score * 0.5 });
        continue;
      }
    }

    // Check keywords
    for (const keyword of action.keywords) {
      const keywordMatch = fuzzyMatch(query, keyword);
      if (keywordMatch.match) {
        results.push({ ...action, score: keywordMatch.score * 0.3 });
        break;
      }
    }
  }

  // Search topics
  for (const topic of topics) {
    const match = fuzzyMatch(query, topic.displayName);
    if (match.match) {
      results.push({
        id: `topic-${topic.name}`,
        type: 'topic',
        label: topic.displayName,
        description: 'Jump to topic',
        keywords: [topic.displayName, topic.name],
        icon: 'M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l4-4m-4 4L8 9',
        execute: () => {}, // Will be set by caller
        score: match.score,
      });
    }
  }

  // Search subscriptions
  for (const subscription of subscriptions) {
    const match = fuzzyMatch(query, subscription.displayName);
    if (match.match) {
      results.push({
        id: `subscription-${subscription.name}`,
        type: 'subscription',
        label: subscription.displayName,
        description: 'Jump to subscription',
        keywords: [subscription.displayName, subscription.name],
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        execute: () => {}, // Will be set by caller
        score: match.score,
      });
    }
  }

  // Sort by score (highest first), then by type (actions first, then topics, then subscriptions)
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const typeOrder = { action: 0, topic: 1, subscription: 2 };
    return typeOrder[a.type] - typeOrder[b.type];
  });

  // Limit results
  return results.slice(0, 10).map(({ score, ...action }) => action);
};

/**
 * Group actions by type
 */
export const groupActions = (actions: CommandBarAction[]): {
  actions: CommandBarAction[];
  topics: CommandBarAction[];
  subscriptions: CommandBarAction[];
} => {
  const grouped = {
    actions: [] as CommandBarAction[],
    topics: [] as CommandBarAction[],
    subscriptions: [] as CommandBarAction[],
  };

  for (const action of actions) {
    if (action.type === 'action') {
      grouped.actions.push(action);
    } else if (action.type === 'topic') {
      grouped.topics.push(action);
    } else if (action.type === 'subscription') {
      grouped.subscriptions.push(action);
    }
  }

  return grouped;
};

/**
 * Highlight matching text in a string
 */
export const highlightMatch = (text: string, query: string): Array<{ text: string; match: boolean }> => {
  if (!query.trim()) {
    return [{ text, match: false }];
  }

  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return [{ text, match: false }];
  }

  const parts = [
    { text: text.substring(0, index), match: false },
    { text: text.substring(index, index + query.length), match: true },
    { text: text.substring(index + query.length), match: false },
  ].filter(part => part.text.length > 0);

  return parts;
};
