/**
 * User ID management utility
 * Generates and stores a unique user ID in localStorage
 * This enables multi-user data isolation without backend authentication
 */

const USER_ID_KEY = 'presenton_user_id';

/**
 * Generates a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Gets the current user ID from localStorage
 * If no user ID exists, generates a new one and stores it
 */
export function getUserId(): string {
  if (typeof window === 'undefined') {
    // Server-side rendering - return empty string
    return '';
  }

  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId = generateUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}

/**
 * Clears the user ID from localStorage
 * This can be used for "logout" or "switch user" functionality
 */
export function clearUserId(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(USER_ID_KEY);
}

/**
 * Sets a specific user ID (useful for testing or user switching)
 */
export function setUserId(userId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(USER_ID_KEY, userId);
}
