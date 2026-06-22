import dayjs from 'dayjs'
import { SCHEDULE_STATUSES, SCHEDULE_TARGET_TYPES } from '../services/scheduleService'

export const QUICK_CREATE_STORAGE_KEY = 'ds_quick_create_schedule_v1'

/**
 * @typedef {Object} QuickCreateFormValues
 * @property {number} [playlistId]
 * @property {number} [layoutId]
 * @property {import('../services/scheduleService').ScheduleTargetType} [targetType]
 * @property {number} [screenId]
 * @property {number} [screenGroupId]
 * @property {string} [scheduleName]
 * @property {string} [startDatetime]
 * @property {string} [endDatetime]
 * @property {number} [priority]
 * @property {import('../services/scheduleService').ScheduleStatus} [status]
 * @property {string} [notes]
 */

/**
 * @typedef {Object} QuickCreatePersistedState
 * @property {boolean} active
 * @property {boolean} modalOpen
 * @property {number} currentStep
 * @property {QuickCreateFormValues} formValues
 */

/** @returns {QuickCreateFormValues} */
export function getDefaultQuickCreateFormValues() {
  return {
    playlistId: undefined,
    layoutId: undefined,
    targetType: SCHEDULE_TARGET_TYPES.SCREEN,
    screenId: undefined,
    screenGroupId: undefined,
    scheduleName: '',
    startDatetime: dayjs().add(1, 'hour').startOf('hour').toISOString(),
    endDatetime: dayjs().add(1, 'day').startOf('hour').toISOString(),
    priority: 10,
    status: SCHEDULE_STATUSES.DRAFT,
    notes: '',
  }
}

/** @returns {QuickCreatePersistedState} */
export function getInitialQuickCreateState() {
  return {
    active: false,
    modalOpen: false,
    currentStep: 0,
    formValues: getDefaultQuickCreateFormValues(),
  }
}

/**
 * @param {unknown} raw
 * @returns {QuickCreateFormValues}
 */
export function deserializeFormValues(raw) {
  if (!raw || typeof raw !== 'object') return getDefaultQuickCreateFormValues()
  const defaults = getDefaultQuickCreateFormValues()
  return {
    ...defaults,
    ...raw,
    startDatetime: raw.startDatetime || defaults.startDatetime,
    endDatetime: raw.endDatetime || defaults.endDatetime,
  }
}

/**
 * @param {Record<string, unknown>} values
 * @returns {QuickCreateFormValues}
 */
export function serializeFormValues(values) {
  const toIso = (v) => {
    if (v == null || v === '') return undefined
    if (dayjs.isDayjs(v)) return v.isValid() ? v.toISOString() : undefined
    if (typeof v === 'string') return v
    return undefined
  }

  return {
    playlistId: values.playlistId != null ? Number(values.playlistId) : undefined,
    layoutId: values.layoutId != null ? Number(values.layoutId) : undefined,
    targetType: values.targetType || SCHEDULE_TARGET_TYPES.SCREEN,
    screenId: values.screenId != null ? Number(values.screenId) : undefined,
    screenGroupId:
      values.screenGroupId != null ? Number(values.screenGroupId) : undefined,
    scheduleName: typeof values.scheduleName === 'string' ? values.scheduleName : '',
    startDatetime: toIso(values.startDatetime),
    endDatetime: toIso(values.endDatetime),
    priority:
      values.priority != null && Number.isFinite(Number(values.priority))
        ? Math.trunc(Number(values.priority))
        : 10,
    status: values.status || SCHEDULE_STATUSES.DRAFT,
    notes: typeof values.notes === 'string' ? values.notes : '',
  }
}

/**
 * @param {QuickCreateFormValues} stored
 * @returns {Record<string, unknown>}
 */
export function storedToFormFields(stored) {
  const values = deserializeFormValues(stored)
  return {
    ...values,
    startDatetime: values.startDatetime ? dayjs(values.startDatetime) : null,
    endDatetime: values.endDatetime ? dayjs(values.endDatetime) : null,
  }
}

/**
 * @returns {QuickCreatePersistedState | null}
 */
export function readPersistedQuickCreateState() {
  try {
    const raw = localStorage.getItem(QUICK_CREATE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      active: Boolean(parsed.active),
      modalOpen: Boolean(parsed.modalOpen),
      currentStep: Number.isFinite(Number(parsed.currentStep)) ? Number(parsed.currentStep) : 0,
      formValues: deserializeFormValues(parsed.formValues),
    }
  } catch {
    return null
  }
}

/** @param {QuickCreatePersistedState} state */
export function writePersistedQuickCreateState(state) {
  try {
    localStorage.setItem(QUICK_CREATE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function clearPersistedQuickCreateState() {
  try {
    localStorage.removeItem(QUICK_CREATE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
