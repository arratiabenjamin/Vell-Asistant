import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type VoiceUiState = 'idle' | 'unsupported' | 'listening' | 'transcribing' | 'sending' | 'error'

type UseVoiceInputOptions = {
  onTranscript: (text: string) => Promise<void>
  disabled?: boolean
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const scopedWindow = window as WindowWithSpeech
  return scopedWindow.SpeechRecognition ?? scopedWindow.webkitSpeechRecognition ?? null
}

export function useVoiceInput({ onTranscript, disabled = false }: UseVoiceInputOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const stateRef = useRef<VoiceUiState>('idle')
  const transcriptRef = useRef('')
  const [state, setState] = useState<VoiceUiState>('idle')
  const [error, setError] = useState<string | null>(null)

  const supported = useMemo(() => Boolean(getSpeechRecognitionCtor()), [])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  const syncState = useCallback((nextState: VoiceUiState) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    recognition.stop()
  }, [])

  const startListening = useCallback(() => {
    if (disabled) return
    if (stateRef.current === 'listening' || stateRef.current === 'transcribing' || stateRef.current === 'sending') {
      return
    }

    const SpeechRecognition = getSpeechRecognitionCtor()
    if (!SpeechRecognition) {
      syncState('unsupported')
      setError('SpeechRecognition no disponible en este runtime.')
      return
    }

    transcriptRef.current = ''
    setError(null)

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-419'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      syncState('listening')
    }

    recognition.onerror = event => {
      const message = event.error ? `voice error: ${event.error}` : 'voice error'
      setError(message)
      recognitionRef.current = null
      syncState('error')
    }

    recognition.onresult = event => {
      let merged = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const chunk = event.results[index]?.[0]?.transcript
        if (chunk) merged += `${chunk} `
      }
      transcriptRef.current = merged.trim()
    }

    recognition.onend = () => {
      recognitionRef.current = null
      const finalTranscript = transcriptRef.current.trim()
      if (!finalTranscript) {
        if (stateRef.current !== 'error') {
          syncState('idle')
        }
        return
      }

      syncState('transcribing')
      queueMicrotask(() => {
        syncState('sending')
        void onTranscript(finalTranscript)
          .then(() => {
            syncState('idle')
          })
          .catch(transcriptError => {
            const message =
              transcriptError instanceof Error ? transcriptError.message : String(transcriptError)
            setError(`voice send error: ${message}`)
            syncState('error')
          })
      })
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (startError) {
      recognitionRef.current = null
      const message = startError instanceof Error ? startError.message : String(startError)
      setError(`voice start error: ${message}`)
      syncState('error')
    }
  }, [disabled, onTranscript, syncState])

  const clearError = useCallback(() => {
    setError(null)
    if (stateRef.current === 'error') {
      syncState('idle')
    }
  }, [syncState])

  return {
    supported,
    state,
    error,
    startListening,
    stopListening,
    clearError
  }
}

export type { VoiceUiState }
