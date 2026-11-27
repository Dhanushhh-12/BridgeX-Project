/**
 * AI Assistant configuration, validation rules, and grounded example prompts
 * matching backend/services/llm_service.py and assistant_service.py.
 */

export const MAX_CHAT_MESSAGE_LENGTH = 1000 // Matches MAX_CHAT_MESSAGE_LENGTH in llm_service.py

export interface SuggestedPrompt {
  id: string
  category: string
  question: string
}

export const SUGGESTED_ASSISTANT_PROMPTS: SuggestedPrompt[] = [
  {
    id: 'general',
    category: 'Platform Overview',
    question: 'Summarize the current AI Bridge X project setup and available modules.',
  },
  {
    id: 'ml-latest',
    category: 'ML Model',
    question: 'Explain what the XGBoost prediction model takes as inputs and what it predicts.',
  },
  {
    id: 'ml-duration',
    category: 'Duration vs Delay',
    question: 'What does a predicted actual_duration mean compared to planned duration?',
  },
  {
    id: 'weather',
    category: 'Weather Risk',
    question: 'Explain how the Open-Meteo rainfall forecast supports construction monitoring.',
  },
  {
    id: 'cv-latest',
    category: 'Computer Vision',
    question: 'Summarize the latest saved progress report observations.',
  },
  {
    id: 'gaps',
    category: 'Data Availability',
    question: 'Which project information is currently available vs missing in AI Bridge X?',
  },
]

export function validateChatMessage(raw: string): {
  valid: boolean
  cleaned: string
  error?: string
} {
  const cleaned = raw.trim()
  if (!cleaned) {
    return {
      valid: false,
      cleaned,
      error: 'Please enter a non-empty question before sending.',
    }
  }
  if (cleaned.length > MAX_CHAT_MESSAGE_LENGTH) {
    return {
      valid: false,
      cleaned,
      error: `Message length (${cleaned.length}) exceeds the ${MAX_CHAT_MESSAGE_LENGTH}-character limit.`,
    }
  }
  return { valid: true, cleaned }
}
