import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  Bot,
  Info,
  Lock,
  MessageSquarePlus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { ChatMessageBubble, type ChatMessage } from '../components/assistant'
import { PageHeader } from '../components/layout'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingIndicator,
} from '../components/ui'
import {
  MAX_CHAT_MESSAGE_LENGTH,
  SUGGESTED_ASSISTANT_PROMPTS,
  validateChatMessage,
} from '../data/assistantSuggestions'
import { ApiClientError, getHealth, postAiChat } from '../services/apiClient'
import type { HealthResponse } from '../types/api'

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<{ title: string; message: string } | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [healthNonce, setHealthNonce] = useState(0)

  const [apiHealth, setApiHealth] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: HealthResponse | null
  }>({ status: 'loading', data: null })

  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((data) => {
        if (!cancelled) setApiHealth({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setApiHealth({ status: 'error', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [healthNonce])

  useEffect(() => {
    if (messages.length === 0 && !isSending) return
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' })
  }, [isSending, messages])

  async function submitQuestion(rawQuestion: string) {
    if (isSending) return
    const validation = validateChatMessage(rawQuestion)
    if (!validation.valid) {
      setInputError(validation.error ?? 'Invalid message.')
      return
    }

    setInputError(null)
    setApiError(null)

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: validation.cleaned,
      timestamp: nowTime,
    }

    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setIsSending(true)

    try {
      const response = await postAiChat({ message: validation.cleaned })
      const replyText = (response.response || '').trim() || 'No response text was returned.'
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const status = err instanceof ApiClientError ? err.status : 0
      const message =
        err instanceof Error
          ? err.message
          : 'Could not receive a response from POST /ai/chat.'
      setApiError({
        title:
          status === 503
            ? 'Local Ollama Assistant Unavailable (HTTP 503)'
            : status === 400 || status === 422
              ? 'Message Validation Error'
              : 'Assistant Request Failed',
        message,
      })
    } finally {
      setIsSending(false)
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitQuestion(draft)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submitQuestion(draft)
    }
  }

  function handleNewConversation() {
    if (isSending) return
    setMessages([])
    setDraft('')
    setInputError(null)
    setApiError(null)
  }

  const charCount = draft.length
  const overLimit = charCount > MAX_CHAT_MESSAGE_LENGTH

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence Engines"
        title="AI Bridge X Assistant"
        description="Ask project, ML duration, weather risk, and computer vision questions processed locally through FastAPI and Ollama."
        breadcrumbs={[{ label: 'AI Assistant' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {apiHealth.status === 'ready' && apiHealth.data ? (
              <Badge variant="success" showDot>
                API {apiHealth.data.version}: {apiHealth.data.status}
              </Badge>
            ) : apiHealth.status === 'error' ? (
              <Badge variant="critical" showDot>
                Backend Offline
              </Badge>
            ) : (
              <Badge variant="neutral">Checking API...</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              isLoading={apiHealth.status === 'loading'}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => setHealthNonce((n) => n + 1)}
            >
              Check Backend
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isSending || (messages.length === 0 && !apiError)}
              leftIcon={<MessageSquarePlus className="h-3.5 w-3.5" />}
              onClick={handleNewConversation}
            >
              New Conversation
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-12">
        {/* Main Conversation Column */}
        <Card padding="none" className="flex min-h-[420px] flex-col sm:min-h-[520px] xl:col-span-8 xl:min-h-[560px]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-neutral bg-ivory/60 px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="flex min-w-0 items-center gap-2">
              <Bot className="h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
              <span className="truncate text-xs font-semibold text-editorial-blue sm:text-sm">
                Local Ollama Inference (<code>POST /ai/chat</code>)
              </span>
            </div>
            <Badge variant="neutral">Session-Only Thread</Badge>
          </div>

          {/* Scrollable Message Viewport */}
          <div
            role="log"
            aria-label="Assistant conversation history"
            aria-live="polite"
            className="flex-1 max-h-[52dvh] space-y-4 overflow-y-auto bg-ivory/35 p-3.5 sm:max-h-[480px] sm:p-5"
          >
            {messages.length === 0 ? (
              <div className="space-y-5 py-4">
                <div className="text-center max-w-lg mx-auto space-y-1.5">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-sm border border-border-neutral bg-surface text-editorial-blue">
                    <Sparkles className="h-5 w-5 text-coral" aria-hidden="true" />
                  </div>
                  <h2 className="bx-heading-card">Ask About AI Bridge X</h2>
                  <p className="text-xs leading-relaxed text-charcoal/80">
                    Questions are classified by <code>assistant_service.py</code>, grounded in
                    available local files, and answered by local Ollama without sending project data
                    to paid external APIs.
                  </p>
                </div>

                <div>
                  <p className="bx-label mb-2.5 text-center">Suggested Questions</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {SUGGESTED_ASSISTANT_PROMPTS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        disabled={isSending}
                        onClick={() => void submitQuestion(item.question)}
                        className="flex flex-col items-start gap-1 rounded-sm border border-border-neutral bg-surface p-3 text-left transition-colors duration-150 hover:border-editorial-blue hover:bg-sand/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-editorial-blue"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-coral">
                          {item.category}
                        </span>
                        <span className="text-xs font-medium text-editorial-blue">
                          {item.question}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => <ChatMessageBubble key={msg.id} message={msg} />)
            )}

            {isSending && (
              <div className="rounded-sm border border-border-neutral bg-surface px-4 py-3">
                <LoadingIndicator
                  inline
                  size="sm"
                  label="Generating grounded answer with local Ollama..."
                />
              </div>
            )}

            {apiError && (
              <ErrorState
                compact
                title={apiError.title}
                message={apiError.message}
              />
            )}

            <div ref={endRef} />
          </div>

          {/* Message Composer */}
          <form
            onSubmit={handleFormSubmit}
            className="border-t border-border-neutral bg-surface p-4 space-y-2.5"
          >
            <label htmlFor="assistant-message-input" className="bx-label block">
              Your Question (Enter to Send, Shift+Enter for New Line)
            </label>

            <textarea
              id="assistant-message-input"
              rows={3}
              value={draft}
              disabled={isSending}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                setDraft(e.target.value)
                if (inputError) setInputError(null)
              }}
              placeholder="Ask about ML predicted durations, Open-Meteo weather risks, or saved CV progress reports..."
              aria-invalid={Boolean(inputError || overLimit) || undefined}
              className="w-full resize-y rounded-sm border border-border-neutral bg-ivory/40 px-3 py-2 text-sm text-charcoal placeholder:text-charcoal/50 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-editorial-blue disabled:opacity-60"
            />

            {inputError && (
              <p role="alert" className="border-l-2 border-coral pl-2 text-xs font-medium text-editorial-blue">
                {inputError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`font-mono text-xs ${
                  overLimit ? 'font-semibold text-coral' : 'text-charcoal/70'
                }`}
              >
                {charCount} / {MAX_CHAT_MESSAGE_LENGTH} characters
              </span>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSending}
                disabled={isSending}
                leftIcon={<Send className="h-3.5 w-3.5" />}
                className="w-full sm:w-auto"
              >
                Send Message
              </Button>
            </div>
          </form>
        </Card>

        {/* Right Side: Grounding, Privacy & Limitations */}
        <div className="xl:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-editorial-blue" aria-hidden="true" />
                <CardTitle>Local Privacy &amp; Routing</CardTitle>
              </div>
              <Badge variant="success">100% Local</Badge>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs leading-relaxed text-charcoal/85">
              <p>
                <strong className="text-editorial-blue">No Direct Port 11434 Exposure:</strong> The
                browser sends questions only to FastAPI (<code>POST /ai/chat</code>), which
                enforces a localhost-only guard before calling Ollama (<code>qwen2.5:0.5b</code>).
              </p>
              <p>
                <strong className="text-editorial-blue">Zero Cloud AI:</strong> No OpenAI, Claude,
                or Gemini APIs or keys are used, and model outputs are rendered strictly as escaped
                plain text (no raw HTML injection).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-coral" aria-hidden="true" />
                <CardTitle>Grounded Data Sources</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-charcoal/85">
              <CardDescription className="mt-0 text-charcoal/80">
                <code>assistant_service.py</code> reads verified local state dynamically on each
                request:
              </CardDescription>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Trained XGBoost model (<code>delay_predictor.pkl</code>) &amp; synthetic CSV status
                </li>
                <li>Saved segmented masks count (<code>data/images/segmented/</code>)</li>
                <li>Newest CV comparison CSV report summary (<code>data/images/reports/</code>)</li>
                <li>Specialized prompt rules blocking fabricated completion % or safety claims</li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="sand">
            <CardContent className="flex items-start gap-2.5 pt-0 text-xs text-charcoal">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
              <div className="space-y-1.5">
                <p>
                  <strong className="text-editorial-blue">Advisory Notice:</strong> AI responses are
                  informational summaries generated by a compact local model (<code>qwen2.5:0.5b</code>)
                  and are <strong>not</strong> certified engineering guidance.
                </p>
                <p className="text-[11px] text-charcoal/75">
                  Stateless backend: conversation history lives in the current browser session only
                  until a chat-history database endpoint is added.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
