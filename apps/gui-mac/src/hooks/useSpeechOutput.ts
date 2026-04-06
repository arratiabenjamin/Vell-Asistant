import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type SpeechOutputState = 'idle' | 'unsupported' | 'speaking' | 'error'

type UseSpeechOutputOptions = {
  lang?: string
  rate?: number
  pitch?: number
  volume?: number
}

export function useSpeechOutput(options: UseSpeechOutputOptions = {}) {
  const { lang = 'es-CL', rate = 1, pitch = 1, volume = 1 } = options
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const stateRef = useRef<SpeechOutputState>('idle')
  const [state, setState] = useState<SpeechOutputState>('idle')
  const [error, setError] = useState<string | null>(null)

  const supported = useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  }, [])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    speechSynthesisRef.current = window.speechSynthesis

    return () => {
      speechSynthesisRef.current?.cancel()
      utteranceRef.current = null
      stateRef.current = 'idle'
    }
  }, [])

  const syncState = useCallback((nextState: SpeechOutputState) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const cancel = useCallback(() => {
    speechSynthesisRef.current?.cancel()
    utteranceRef.current = null
    syncState('idle')
  }, [syncState])

  const clearError = useCallback(() => {
    setError(null)
    if (stateRef.current === 'error') {
      syncState('idle')
    }
  }, [syncState])

  const speak = useCallback(
    (text: string) => {
      const normalized = text.trim()
      if (!normalized) return

      if (!supported) {
        setError('Speech synthesis no disponible en este runtime.')
        syncState('unsupported')
        return
      }

      cancel()
      setError(null)

      const synthesis = speechSynthesisRef.current ?? window.speechSynthesis
      const utterance = new SpeechSynthesisUtterance(normalized)
      utterance.lang = lang
      utterance.rate = rate
      utterance.pitch = pitch
      utterance.volume = volume

      utterance.onstart = () => {
        syncState('speaking')
      }

      utterance.onerror = event => {
        const message = event.error ? `tts error: ${event.error}` : 'tts error'
        setError(message)
        utteranceRef.current = null
        syncState('error')
      }

      utterance.onend = () => {
        utteranceRef.current = null
        if (stateRef.current !== 'error') {
          syncState('idle')
        }
      }

      utteranceRef.current = utterance

      try {
        synthesis.speak(utterance)
      } catch (speakError) {
        const message = speakError instanceof Error ? speakError.message : String(speakError)
        setError(`tts start error: ${message}`)
        utteranceRef.current = null
        syncState('error')
      }
    },
    [cancel, lang, pitch, rate, supported, syncState, volume]
  )

  return {
    supported,
    state,
    error,
    speak,
    cancel,
    clearError
  }
}
