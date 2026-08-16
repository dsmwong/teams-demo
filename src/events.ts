import { EventEmitter } from 'events';

export const callEvents = new EventEmitter();
callEvents.setMaxListeners(50);

export type LogType = 'call' | 'cr' | 'ai' | 'transfer' | 'twiml' | 'error' | 'clear';

export interface LogEvent {
  ts: string;
  type: LogType;
  label: string;
  detail?: string;
  callSid?: string;
}

export function emit(type: LogType, label: string, detail?: string, callSid?: string): void {
  callEvents.emit('log', { ts: new Date().toISOString(), type, label, detail, callSid } as LogEvent);
}
