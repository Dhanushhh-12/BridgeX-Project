import { useState } from 'react'
import { Bot, Check, Copy, User } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { BX_OVERLAY_TRANSITION } from '../../lib/motion'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatMessageBubbleProps {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={BX_OVERLAY_TRANSITION}
      aria-label={`${isUser ? 'User' : 'Assistant'} message at ${message.timestamp}`}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-neutral bg-sand text-editorial-blue"
          aria-hidden="true"
        >
          <Bot className="h-4 w-4 text-coral" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-sm border px-4 py-3 sm:max-w-[78%]',
          isUser
            ? 'border-editorial-blue bg-editorial-blue text-surface'
            : 'border-border-neutral bg-surface text-charcoal',
        )}
      >
        <div
          className={cn(
            'mb-1.5 flex items-center justify-between gap-4 text-[11px]',
            isUser ? 'text-sand/85' : 'text-charcoal/70',
          )}
        >
          <span className="font-semibold uppercase tracking-wide">
            {isUser ? 'You' : 'AI Bridge X Assistant'}
          </span>
          <span className="font-mono">{message.timestamp}</span>
        </div>

        {/* Strict text-only rendering prevents any unsafe HTML/XSS from LLM outputs */}
        <p
          className={cn(
            'whitespace-pre-wrap break-words text-sm leading-relaxed',
            isUser ? 'text-surface' : 'text-charcoal',
          )}
        >
          {message.content}
        </p>

        {!isUser && (
          <div className="mt-2.5 flex items-center justify-end border-t border-border-neutral pt-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              aria-label="Copy assistant response"
              className="inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-[11px] font-medium text-editorial-blue hover:bg-sand/70"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Response</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-editorial-blue bg-editorial-blue text-surface"
          aria-hidden="true"
        >
          <User className="h-4 w-4 text-coral" />
        </div>
      )}
    </motion.article>
  )
}
