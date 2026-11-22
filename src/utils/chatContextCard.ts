import type { ChatContextCard } from '../types/marketplace';

const PENDING_CHAT_CARD_KEY = 'kova_pending_chat_card';

export function savePendingChatCard(
  storeId: number | null,
  card: ChatContextCard,
) {
  try {
    window.sessionStorage.setItem(
      PENDING_CHAT_CARD_KEY,
      JSON.stringify({
        storeId: storeId ?? null,
        card,
        createdAt: Date.now(),
      }),
    );
  } catch {
    // Ignore storage quota / privacy errors
  }
}

export function consumePendingChatCard(
  storeId: number | null,
): ChatContextCard | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_CHAT_CARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      storeId?: number | null;
      card?: ChatContextCard | null;
      createdAt?: number;
    };
    if (!parsed?.card) {
      window.sessionStorage.removeItem(PENDING_CHAT_CARD_KEY);
      return null;
    }
    if (parsed.createdAt && Date.now() - parsed.createdAt > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(PENDING_CHAT_CARD_KEY);
      return null;
    }
    if (
      parsed.storeId != null &&
      storeId != null &&
      Number(parsed.storeId) !== Number(storeId)
    ) {
      return null;
    }
    window.sessionStorage.removeItem(PENDING_CHAT_CARD_KEY);
    return parsed.card;
  } catch {
    window.sessionStorage.removeItem(PENDING_CHAT_CARD_KEY);
    return null;
  }
}
