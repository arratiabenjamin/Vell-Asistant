import { useCallback, useMemo, useRef, useState } from 'react'

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
  const transcriptRef = useRef('')
  const [state, setState] = useState<VoiceUiState>('idle')
  const [error, setError] = useState<string | null>(null)

  const supported = useMemo(() => Boolean(getSpeechRecognitionCtor()), [])

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    recognition.stop()
  }, [])

  const startListening = useCallback(() => {
    if (disabled) return

    const SpeechRecognition = getSpeechRecognitionCtor()
    if (!SpeechRecognition) {
      setState('unsupported')
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
      setState('listening')
    }

    recognition.onerror = event => {
      const message = event.error ? `voice error: ${event.error}` : 'voice error'
      setError(message)
      setState('error')
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
      const finalTranscript = transcriptRef.current.trim()
      if (!finalTranscript) {
        if (state === 'listening') {
          setState('idle')
        }
        return
      }

      setState('transcribing')
      void onTranscript(finalTranscript)
        .then(() => {
          setState('sending')
        })
        .then(() => {
          setState('idle')
        })
        .catch(transcriptError => {
          const message =
            transcriptError instanceof Error ? transcriptError.message : String(transcriptError)
          setError(`voice send error: ${message}`)
          setState('error')
        })
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : String(startError)
      setError(`voice start error: ${message}`)
      setState('error')
    }
  }, [disabled, onTranscript, state])

  const clearError = useCallback(() => {
    setError(null)
    setState('idle')
  }, [])

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
