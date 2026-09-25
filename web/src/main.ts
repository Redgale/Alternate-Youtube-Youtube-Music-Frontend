import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';

import { onRouteChange, navigate } from './router.js';
import { renderHome } from './views/home.js';
import { renderWatch } from './views/watch.js';
import { renderMusic } from './views/music.js';
<<<<<<< HEAD
import { renderShorts, cleanupShorts } from './views/shorts.js';
=======
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
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

<<<<<<< HEAD
=======
// Navigation happens via navigate() rather than a plain href="#/..." fragment
// so it works when this document is hosted under a <base href="..."> pointing
// elsewhere (e.g. a portal wrapping this page in a blob: URL and injecting an
// absolute base so its other relative asset references resolve) — under a
// foreign <base>, an href-driven click would resolve to a real cross-origin
// URL instead of just updating the current document's hash.
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
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

<<<<<<< HEAD
const shortsLink = document.createElement('a');
shortsLink.className = 'shell__nav-link';
shortsLink.textContent = 'Shorts';
shortsLink.href = '#/shorts';
shortsLink.addEventListener('click', (e) => {
  e.preventDefault();
  navigate('/shorts');
});

nav.append(videosLink, musicLink, shortsLink);
=======
nav.append(videosLink, musicLink);
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
header.append(brand, nav);

const main = document.createElement('main');
main.className = 'shell__main';

shell.append(header, main);
app.appendChild(shell);

mountFloatingPlayer(app);

onRouteChange((route) => {
  videosLink.classList.toggle('is-active', route.path === '/');
  musicLink.classList.toggle('is-active', route.path === '/music');
<<<<<<< HEAD
  shortsLink.classList.toggle('is-active', route.path === '/shorts');

  if (route.path !== '/shorts') {
    cleanupShorts();
  }
=======
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870

  if (route.path === '/watch') {
    const v = route.query.get('v');
    if (!v) {
      navigate('/');
      return;
    }
    renderWatch(main, v);
  } else if (route.path === '/music') {
    renderMusic(main, route.query.get('q') ?? '');
<<<<<<< HEAD
  } else if (route.path === '/shorts') {
    renderShorts(main, route.query.get('q') ?? '');
=======
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
  } else {
    renderHome(main, route.query.get('q') ?? '');
  }
});
