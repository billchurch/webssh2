/**
 * Metadata state reducer
 */

import type { SessionMetadata } from '../types.js'
import type { MetadataAction, SessionAction } from '../actions.js'

type TimestampAction = Extract<MetadataAction, { type: 'METADATA_UPDATE_TIMESTAMP' }> |
  Extract<SessionAction, { type: 'CONNECTION_ACTIVITY' }> |
  Extract<SessionAction, { type: 'TERMINAL_RESIZE' }>

const metadataActionTypes = new Set<MetadataAction['type']>([
  'METADATA_SET_CLIENT',
  'METADATA_UPDATE',
  'METADATA_UPDATE_TIMESTAMP'
])

const timestampActionTypes = new Set<TimestampAction['type']>([
  'METADATA_UPDATE_TIMESTAMP',
  'CONNECTION_ACTIVITY',
  'TERMINAL_RESIZE'
])

function isMetadataAction(action: SessionAction): action is MetadataAction {
  return metadataActionTypes.has(action.type as MetadataAction['type'])
}

function isTimestampAction(action: SessionAction): action is TimestampAction {
  return timestampActionTypes.has(action.type as TimestampAction['type'])
}

function updateClientMetadata(
  state: SessionMetadata,
  action: Extract<MetadataAction, { type: 'METADATA_SET_CLIENT' }>
): SessionMetadata {
  return {
    ...state,
    clientIp: action.payload.clientIp,
    userAgent: action.payload.userAgent,
    updatedAt: Date.now()
  }
}

function mergeMetadataUpdate(
  state: SessionMetadata,
  action: Extract<MetadataAction, { type: 'METADATA_UPDATE' }>
): SessionMetadata {
  const { userId, clientIp, userAgent, updatedAt } = action.payload

  return {
    ...state,
    ...(userId === undefined ? {} : { userId }),
    ...(clientIp === undefined ? {} : { clientIp }),
    ...(userAgent === undefined ? {} : { userAgent }),
    updatedAt: updatedAt ?? Date.now()
  }
}

function setMetadataUser(
  state: SessionMetadata,
  action: Extract<SessionAction, { type: 'AUTH_SUCCESS' }>
): SessionMetadata {
  return {
    ...state,
    userId: action.payload.userId ?? null,
    updatedAt: Date.now()
  }
}

function touchMetadata(state: SessionMetadata): SessionMetadata {
  return {
    ...state,
    updatedAt: Date.now()
  }
}

/**
 * Metadata reducer - handles session metadata state transitions
 */
export const metadataReducer = (
  state: SessionMetadata,
  action: SessionAction
): SessionMetadata => {
  if (isMetadataAction(action)) {
    if (action.type === 'METADATA_SET_CLIENT') {
      return updateClientMetadata(state, action)
    }

    if (action.type === 'METADATA_UPDATE') {
      return mergeMetadataUpdate(state, action)
    }

    return touchMetadata(state)
  }

  if (isTimestampAction(action)) {
    return touchMetadata(state)
  }

  if (action.type === 'AUTH_SUCCESS') {
    return setMetadataUser(state, action)
  }

  return state
}
