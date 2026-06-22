import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { canWrite } from '../services/authService'
import {
  clearPersistedQuickCreateState,
  getDefaultQuickCreateFormValues,
  getInitialQuickCreateState,
  readPersistedQuickCreateState,
  serializeFormValues,
  writePersistedQuickCreateState,
} from './quickCreateScheduleStorage'

/** @typedef {import('react').ReactNode} ReactNode */

const QuickCreateScheduleContext = createContext(null)

/** @param {{ children: ReactNode }} props */
export function QuickCreateScheduleProvider({ children }) {
  const writable = canWrite()
  const [state, setState] = useState(() => {
    if (!writable) return getInitialQuickCreateState()
    const saved = readPersistedQuickCreateState()
    return saved?.active ? saved : getInitialQuickCreateState()
  })

  useEffect(() => {
    if (!writable) {
      clearPersistedQuickCreateState()
      setState(getInitialQuickCreateState())
    }
  }, [writable])

  useEffect(() => {
    if (!writable) return
    if (state.active) {
      writePersistedQuickCreateState(state)
    } else {
      clearPersistedQuickCreateState()
    }
  }, [state, writable])

  const startQuickCreate = useCallback(() => {
    if (!writable) return
    setState((prev) => {
      if (prev.active) {
        return { ...prev, modalOpen: true }
      }
      return {
        active: true,
        modalOpen: true,
        currentStep: 0,
        formValues: getDefaultQuickCreateFormValues(),
      }
    })
  }, [writable])

  const openWizard = useCallback(() => {
    if (!writable) return
    setState((prev) => (prev.active ? { ...prev, modalOpen: true } : prev))
  }, [writable])

  const minimizeWizard = useCallback(() => {
    setState((prev) => (prev.active ? { ...prev, modalOpen: false } : prev))
  }, [])

  const clearQuickCreate = useCallback(() => {
    setState(getInitialQuickCreateState())
    clearPersistedQuickCreateState()
  }, [])

  const completeQuickCreate = useCallback(() => {
    clearQuickCreate()
  }, [clearQuickCreate])

  const setCurrentStep = useCallback((step) => {
    setState((prev) =>
      prev.active
        ? { ...prev, currentStep: Math.max(0, Math.min(4, Math.trunc(Number(step)))) }
        : prev,
    )
  }, [])

  const updateFormValues = useCallback((values) => {
    setState((prev) => {
      if (!prev.active) return prev
      const patch = {}
      for (const [key, val] of Object.entries(values)) {
        if (val !== undefined) patch[key] = val
      }
      return { ...prev, formValues: serializeFormValues({ ...prev.formValues, ...patch }) }
    })
  }, [])

  const value = useMemo(
    () => ({
      writable,
      active: state.active,
      modalOpen: state.modalOpen,
      currentStep: state.currentStep,
      formValues: state.formValues,
      startQuickCreate,
      openWizard,
      minimizeWizard,
      clearQuickCreate,
      completeQuickCreate,
      setCurrentStep,
      updateFormValues,
    }),
    [
      writable,
      state,
      startQuickCreate,
      openWizard,
      minimizeWizard,
      clearQuickCreate,
      completeQuickCreate,
      setCurrentStep,
      updateFormValues,
    ],
  )

  return (
    <QuickCreateScheduleContext.Provider value={value}>
      {children}
    </QuickCreateScheduleContext.Provider>
  )
}

export function useQuickCreateSchedule() {
  const ctx = useContext(QuickCreateScheduleContext)
  if (!ctx) {
    throw new Error('useQuickCreateSchedule must be used within QuickCreateScheduleProvider')
  }
  return ctx
}
