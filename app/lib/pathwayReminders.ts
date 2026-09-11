// Shared helpers for the pathway reminder scripts (scripts/send-pathway-reminders.ts
// and scripts/send-custom-pathway-reminders.ts).

export const MESSAGES = [
  "Let's start your day with some learning! 🌱",
  "Ready to grow? Your next lesson is calling your name.",
  "A few minutes of learning today, a big step forward tomorrow.",
  "Good morning! Your learning journey is waiting for you.",
  "Small steps, big growth — let's keep the momentum going!",
  "Today's a great day to learn something new.",
]

export function pickMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
}

// Resend's default rate limit is 2 requests/second; stay comfortably under it
// (and under Mailtrap's sandbox limit) by sending one at a time with a pause.
export async function sendThrottled<T>(items: T[], delayMs: number, fn: (item: T) => Promise<void>) {
  for (const item of items) {
    await fn(item)
    await new Promise((r) => setTimeout(r, delayMs))
  }
}
