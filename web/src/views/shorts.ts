import type * as Dashjs from 'dashjs';
import { search, dashManifestUrl, type ResultItem } from '../api.js';
import { renderSearchBar } from '../components/search-bar.js';
import { navigate } from '../router.js';

let activePlayer: Dashjs.MediaPlayerClass | null = null;
let teardown: (() => void) | null = null;

function destroyPlayer(): void {
  try {
    activePlayer?.destroy();
  } catch {
    /* ignore */
  }
  activePlayer = null;
}

/** Call when leaving the Shorts route so listeners / player are released. */
export function cleanupShorts(): void {
  teardown?.();
  teardown = null;
  destroyPlayer();
}

/**
 * Vertical Shorts-style feed: one full-viewport clip at a time.
 * Navigate with ↑/↓ (or j/k), mouse wheel, or vertical drag/swipe.
 * No likes, subscribe, or comment UI.
 */
export function renderShorts(container: HTMLElement, query: string): void {
  teardown?.();
  teardown = null;
  destroyPlayer();

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'view view--shorts';

  const header = document.createElement('div');
  header.className = 'view__header shorts__header';
  const heading = document.createElement('h1');
  heading.className = 'view__heading view__heading--shorts';
  heading.textContent = 'Shorts';
  header.appendChild(heading);
  header.appendChild(
    renderSearchBar('Search shorts', query, (q) => {
      navigate('/shorts', { q });
      renderShorts(container, q);
    }),
  );

  const stage = document.createElement('div');
  stage.className = 'shorts-stage';
  stage.tabIndex = 0;

  const hint = document.createElement('p');
  hint.className = 'shorts-hint';
  hint.textContent = '↑ ↓ · scroll · drag';

  wrap.append(header, stage, hint);
  container.appendChild(wrap);

  // Immersive layout: tighter main padding while Shorts is open
  const main = container.closest('.shell__main');
  main?.classList.add('shell__main--shorts');
  teardown = () => {
    destroyPlayer();
    main?.classList.remove('shell__main--shorts');
    window.removeEventListener('keydown', onKey);
    stage.removeEventListener('wheel', onWheel);
    stage.removeEventListener('pointerdown', onPointerDown);
  };

  if (!query) {
    stage.innerHTML =
      '<p class="view__empty">Search for a topic to watch Shorts.</p>';
    return;
  }

  stage.innerHTML = '<p class="view__loading">Loading shorts…</p>';

  let items: ResultItem[] = [];
  let index = 0;
  let animating = false;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      go(-1);
    }
  };

  let wheelLock = 0;
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now < wheelLock) return;
    if (Math.abs(e.deltaY) < 20) return;
    wheelLock = now + 450;
    go(e.deltaY > 0 ? 1 : -1);
  };

  let dragStartY = 0;
  let dragging = false;
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    dragStartY = e.clientY;
    stage.setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dy) > 48) go(dy < 0 ? 1 : -1);
  };

  window.addEventListener('keydown', onKey);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);

  function go(delta: number): void {
    if (animating || items.length === 0) return;
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    index = next;
    showSlide(true);
  }

  function showSlide(animate: boolean): void {
    const item = items[index];
    if (!item) return;
    animating = true;

    stage.innerHTML = '';
    const slide = document.createElement('div');
    slide.className = 'shorts-slide' + (animate ? ' shorts-slide--enter' : '');

    const videoHost = document.createElement('div');
    videoHost.className = 'shorts-slide__video';
    const video = document.createElement('video');
    video.playsInline = true;
    video.autoplay = true;
    video.loop = true;
    video.muted = false;
    video.controls = false;
    videoHost.appendChild(video);

    const overlay = document.createElement('div');
    overlay.className = 'shorts-slide__overlay';
    const title = document.createElement('div');
    title.className = 'shorts-slide__title';
    title.textContent = item.title;
    const sub = document.createElement('div');
    sub.className = 'shorts-slide__sub';
    sub.textContent = [item.author, item.meta].filter(Boolean).join(' · ');
    const counter = document.createElement('div');
    counter.className = 'shorts-slide__counter';
    counter.textContent = `${index + 1} / ${items.length}`;
    overlay.append(title, sub, counter);

    // Tap video to play/pause
    videoHost.addEventListener('click', () => {
      if (video.paused) void video.play();
      else video.pause();
    });

    slide.append(videoHost, overlay);
    stage.appendChild(slide);
    stage.focus({ preventScroll: true });

    destroyPlayer();
    import('dashjs').then((dashjs) => {
      if (!video.isConnected) return;
      const player = dashjs.MediaPlayer().create();
      activePlayer = player;
      player.on(dashjs.MediaPlayer.events.ERROR, () => {
        // Fallback: try progressive stream URL via worker
        void import('../api.js').then(({ streamUrl }) => {
          video.src = streamUrl(item.id, 'video', { kind: 'video' });
          void video.play().catch(() => {});
        });
      });
      player.initialize(video, dashManifestUrl(item.id), true);
    });

    requestAnimationFrame(() => {
      slide.classList.add('shorts-slide--visible');
      animating = false;
    });
  }

  search(query, 'shorts')
    .then((res) => {
      items = res.results;
      if (items.length === 0) {
        stage.innerHTML = '<p class="view__empty">No shorts found.</p>';
        return;
      }
      index = 0;
      showSlide(false);
    })
    .catch((err: Error) => {
      stage.innerHTML = `<p class="view__error">${err.message}</p>`;
    });
}
