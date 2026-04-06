import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type VoiceUiState = 'idle' | 'unsupported' | 'listening' | 'transcribing' | 'sending' | 'error'

type UseVoiceInputOptions = {
  onTranscript: (text: string) => Promise<void>
  disabled?: boolean
}

function describeVoicePermissionHint(error: string | null, supported: boolean): string | null {
  if (!supported) {
    return 'Este runtime no expone SpeechRecognition. Probá la app nativa con permisos de macOS o seguí por texto.'
  }

  switch (error) {
    case 'service-not-allowed':
    case 'not-allowed':
      return 'macOS bloqueó el reconocimiento. Revisá permisos en Privacy & Security → Microphone y Speech Recognition.'
    case 'audio-capture':
      return 'No se detectó micrófono activo. Probá conectarlo o elegir otro input de audio.'
    case 'network':
      return 'El reconocimiento falló por red. Probá de nuevo o usá entrada de texto.'
    case 'language-not-supported':
      return 'El idioma configurado no está soportado en este runtime.'
    default:
      return null
  }
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
  const [hint, setHint] = useState<string | null>(null)

  const supported = useMemo(() => Boolean(getSpeechRecognitionCtor()), [])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!supported) {
      setHint(describeVoicePermissionHint(null, false))
    }
  }, [supported])

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
      setHint(describeVoicePermissionHint(null, false))
      return
    }

    transcriptRef.current = ''
    setError(null)
    setHint(null)

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
      setHint(describeVoicePermissionHint(event.error ?? null, true))
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
      setHint('Volvé a intentar después de aceptar permisos de micrófono y reconocimiento de voz.')
      syncState('error')
    }
  }, [disabled, onTranscript, syncState])

  const clearError = useCallback(() => {
    setError(null)
    setHint(null)
    if (stateRef.current === 'error') {
      syncState('idle')
    }
  }, [syncState])

  return {
    supported,
    state,
    error,
    hint,
    startListening,
    stopListening,
    clearError
  }
}

export type { VoiceUiState }
