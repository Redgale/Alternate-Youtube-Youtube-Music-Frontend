import type { ResultItem } from './api.js';

export interface PlayerState {
  queue: ResultItem[];
  currentIndex: number;
  playing: boolean;
}

type Listener = (state: PlayerState) => void;

const state: PlayerState = {
  queue: [],
  currentIndex: -1,
  playing: false,
};

const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l(state);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getCurrentTrack(): ResultItem | null {
  return state.queue[state.currentIndex] ?? null;
}

export function playQueue(queue: ResultItem[], startIndex: number): void {
  state.queue = queue;
  state.currentIndex = startIndex;
  state.playing = true;
  emit();
}

export function setPlaying(playing: boolean): void {
  state.playing = playing;
  emit();
}

export function playNext(): boolean {
  if (state.currentIndex + 1 < state.queue.length) {
    state.currentIndex += 1;
    state.playing = true;
    emit();
    return true;
  }
  return false;
}

export function playPrevious(): boolean {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    state.playing = true;
    emit();
    return true;
  }
  return false;
}
