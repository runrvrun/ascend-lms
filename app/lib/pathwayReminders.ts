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
