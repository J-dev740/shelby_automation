import { ICONS } from '../assets/icons.js';

export function renderSplash(): HTMLElement {
  const splash = document.createElement('div');
  splash.className = 'splash';
  splash.id = 'splash';
  splash.innerHTML = `
    <div class="splash__logo">${ICONS.logo}</div>
    <div class="splash__name">Shelby</div>
    <div class="splash__tagline">sips · bites · smiles</div>
  `;

  // Remove from DOM after fade animation completes
  splash.addEventListener('animationend', (e) => {
    if ((e as AnimationEvent).animationName === 'splashFade') {
      splash.remove();
    }
  });

  return splash;
}
