import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';

import { onRouteChange, navigate } from './router.js';
import { renderHome } from './views/home.js';
import { renderWatch } from './views/watch.js';
import { renderMusic } from './views/music.js';
import { renderShorts, cleanupShorts } from './views/shorts.js';
import { mountFloatingPlayer } from './components/floating-player.js';

const app = document.getElementById('app')!;

const shell = document.createElement('div');
shell.className = 'shell';

const header = document.createElement('header');
header.className = 'shell__header';

const brand = document.createElement('div');
brand.className = 'shell__brand';
brand.textContent = 'Dashboard';

const nav = document.createElement('nav');
nav.className = 'shell__nav';

const videosLink = document.createElement('a');
videosLink.className = 'shell__nav-link';
videosLink.textContent = 'Videos';
videosLink.href = '#/';
videosLink.addEventListener('click', (e) => {
  e.preventDefault();
  navigate('/');
});

const musicLink = document.createElement('a');
musicLink.className = 'shell__nav-link';
musicLink.textContent = 'Music';
musicLink.href = '#/music';
musicLink.addEventListener('click', (e) => {
  e.preventDefault();
  navigate('/music');
});

const shortsLink = document.createElement('a');
shortsLink.className = 'shell__nav-link';
shortsLink.textContent = 'Shorts';
shortsLink.href = '#/shorts';
shortsLink.addEventListener('click', (e) => {
  e.preventDefault();
  navigate('/shorts');
});

nav.append(videosLink, musicLink, shortsLink);
header.append(brand, nav);

const main = document.createElement('main');
main.className = 'shell__main';

shell.append(header, main);
app.appendChild(shell);

mountFloatingPlayer(app);

onRouteChange((route) => {
  videosLink.classList.toggle('is-active', route.path === '/');
  musicLink.classList.toggle('is-active', route.path === '/music');
  shortsLink.classList.toggle('is-active', route.path === '/shorts');

  if (route.path !== '/shorts') {
    cleanupShorts();
  }

  if (route.path === '/watch') {
    const v = route.query.get('v');
    if (!v) {
      navigate('/');
      return;
    }
    renderWatch(main, v);
  } else if (route.path === '/music') {
    renderMusic(main, route.query.get('q') ?? '');
  } else if (route.path === '/shorts') {
    renderShorts(main, route.query.get('q') ?? '');
  } else {
    renderHome(main, route.query.get('q') ?? '');
  }
});
