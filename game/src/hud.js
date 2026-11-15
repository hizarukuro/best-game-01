// DOM HUD for LURELIGHT: hull, swarm count, wave, score and combo across the
// top; a named event feed down the left; the boss bar when the Undershepherd
// is on the field; a bloom progress tag that tracks the ring in the world;
// and the four screens (title, upgrade draft, pause, game over). The sim
// never touches the DOM — main feeds this module state and events.

import { BLOOM } from './config.js';

const $ = (id) => document.getElementById(id);

export function createHud(handlers) {
  const els = {
    hullFill: $('hull-fill'), hullNum: $('hull-num'),
    swarmNum: $('swarm-num'), waveLabel: $('wave-label'),
    scoreNum: $('score-num'), comboWrap: $('combo-wrap'), comboMult: $('combo-mult'), comboFill: $('combo-fill'),
    bossWrap: $('boss-wrap'), bossFill: $('boss-fill'),
    feed: $('feed'), pulseFill: $('pulse-fill'), pulseLabel: $('pulse-label'),
    bloomTag: $('bloom-tag'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    vignette: $('vignette'),
    title: $('screen-title'), upgrade: $('screen-upgrade'), cards: $('cards'),
    over: $('screen-over'), overStats: $('over-stats'), pause: $('screen-pause'),
    finalScore: $('final-score'),
  };
  let bannerT = 0;
  let lastFeedAt = -10;

  function feed(text, cls = '') {
    const row = document.createElement('div');
    row.className = `feed-row ${cls}`;
    row.textContent = text;
    els.feed.appendChild(row);
    while (els.feed.children.length > 5) els.feed.removeChild(els.feed.firstChild);
    requestAnimationFrame(() => row.classList.add('in'));
    setTimeout(() => { row.classList.add('out'); setTimeout(() => row.remove(), 700); }, 4600);
  }

  function banner(title, sub = '', seconds = 2.4) {
    els.bannerTitle.textContent = title;
    els.bannerSub.textContent = sub;
    els.banner.classList.add('show');
    bannerT = seconds;
  }

  function showUpgrade(dealt) {
    els.cards.innerHTML = '';
    dealt.forEach((u, i) => {
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML = `<span class="card-key">${i + 1}</span><span class="card-name">${u.name}</span><span class="card-desc">${u.desc}</span>`;
      card.addEventListener('click', () => handlers.onUpgrade(u));
      els.cards.appendChild(card);
    });
    els.upgrade.classList.add('show');
  }

  return {
    feed, banner,
    clearBanner() { els.banner.classList.remove('show'); bannerT = 0; },
    showTitle() { els.title.classList.add('show'); },
    hideTitle() { els.title.classList.remove('show'); },
    showUpgrade,
    hideUpgrade() { els.upgrade.classList.remove('show'); },
    showPause(on) { els.pause.classList.toggle('show', on); },
    showOver(world) {
      els.finalScore.textContent = world.score.toLocaleString('en-US');
      els.overStats.textContent = `Wave ${world.wave} reached · ${world.kills} hollow burned · ${world.harvested} blooms harvested · best chain ×${(1 + world.bestCombo * 0.25).toFixed(2).replace(/\.?0+$/, '')}`;
      els.over.classList.add('show');
    },
    hideOver() { els.over.classList.remove('show'); },
    flashDamage() {
      els.vignette.classList.add('hit');
      setTimeout(() => els.vignette.classList.remove('hit'), 130);
    },
    setBloomTag(x, y, visible, inside) {
      if (!visible) { els.bloomTag.style.opacity = '0'; return; }
      els.bloomTag.style.opacity = '1';
      els.bloomTag.style.transform = `translate(-50%, -130%) translate(${x}px, ${y}px)`;
      els.bloomTag.textContent = `BLOOM ${inside}/${BLOOM.need}`;
      els.bloomTag.classList.toggle('ready', inside >= BLOOM.need * 0.7);
    },
    update(world, dt) {
      const d = world.drone;
      if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) els.banner.classList.remove('show'); }
      els.hullFill.style.width = `${Math.max(0, (d.hp / d.hpMax) * 100)}%`;
      els.hullFill.classList.toggle('low', d.hp / d.hpMax < 0.3);
      els.hullNum.textContent = `${Math.ceil(d.hp)} / ${d.hpMax}`;
      els.swarmNum.textContent = String(world.moteCount);
      els.waveLabel.textContent = `WAVE ${world.wave}`;
      els.scoreNum.textContent = world.score.toLocaleString('en-US');
      const c = world.combo;
      els.comboWrap.style.opacity = c.chain > 1 ? '1' : '0.25';
      els.comboMult.textContent = `×${c.mult.toFixed(2).replace(/\.?0+$/, '')}`;
      els.comboFill.style.width = `${Math.max(0, (c.t / 3) * 100)}%`;
      const pulseFrac = 1 - Math.max(0, d.pulseT) / d.pulseCooldown;
      els.pulseFill.style.width = `${pulseFrac * 100}%`;
      els.pulseLabel.textContent = d.pulseT <= 0 ? 'PULSE READY — CLICK / SPACE' : 'PULSE CHARGING';
      els.pulseLabel.classList.toggle('ready', d.pulseT <= 0);
      const boss = world.hunters.find((h) => h.kind === 'undershepherd');
      els.bossWrap.style.opacity = boss ? '1' : '0';
      if (boss) els.bossFill.style.width = `${Math.max(0, (boss.hp / boss.hpMax) * 100)}%`;
      document.body.classList.toggle('lowhp', d.hp / d.hpMax < 0.3 && world.phase !== 'over');
    },
  };
}
