// DOM HUD for LURELIGHT: hull, swarm count, wave, score and combo across the
// top; the standing objective and a live directive under the wave label; the
// Hollow manifest (every hunter kind on the field, named, counted, with its
// trait) down the right; the fitted-overclock loadout down the left; a named
// event feed; the boss bar with its live mote-ring count; a bloom progress
// tag that tracks the ring in the world; and the four screens (title,
// upgrade draft, pause, game over). The sim never touches the DOM — main
// feeds this module state and events.

import { HUNTERS, UPGRADES } from './config.js';

const $ = (id) => document.getElementById(id);

export function createHud(handlers) {
  const els = {
    hullFill: $('hull-fill'), hullNum: $('hull-num'),
    swarmNum: $('swarm-num'), waveLabel: $('wave-label'), directive: $('directive'),
    scoreNum: $('score-num'), bestNum: $('best-num'), comboWrap: $('combo-wrap'), comboMult: $('combo-mult'), comboFill: $('combo-fill'),
    bossWrap: $('boss-wrap'), bossFill: $('boss-fill'), bossSub: $('boss-sub'),
    manifestRows: $('manifest-rows'), manifestCount: $('manifest-count'), manifestFoot: $('manifest-foot'),
    loadoutChips: $('loadout-chips'), loadoutCount: $('loadout-count'),
    feed: $('feed'), pulseFill: $('pulse-fill'), pulseLabel: $('pulse-label'),
    bloomTag: $('bloom-tag'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    vignette: $('vignette'),
    title: $('screen-title'), upgrade: $('screen-upgrade'), cards: $('cards'),
    over: $('screen-over'), overStats: $('over-stats'), pause: $('screen-pause'),
    finalScore: $('final-score'),
  };
  let bannerT = 0;
  let lastFeedAt = -10;
  let manifestSig = '';
  let loadoutSig = '';

  /** The Hollow manifest: one row per hunter kind alive, named + counted. */
  function renderManifest(world) {
    const counts = new Map();
    for (const h of world.hunters) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
    const sig = [...counts.entries()].map(([k, n]) => `${k}:${n}`).join('|')
      + `#${world.spawnQueue.length}#${world.wave}#${world.veil?.id ?? ''}`;
    if (sig === manifestSig) return;
    manifestSig = sig;
    els.manifestCount.textContent = String(world.hunters.length);
    if (counts.size === 0) {
      els.manifestRows.innerHTML = '<div class="panel-empty">The rim is quiet. It will not stay quiet.</div>';
    } else {
      els.manifestRows.innerHTML = [...counts.entries()].map(([kind, n]) => {
        const def = HUNTERS[kind];
        return `<div class="hunter-row"><span class="hunter-dot" style="background:${def.ink}"></span>`
          + `<span class="hunter-name" style="color:${def.ink}">${def.label}</span>`
          + `<span class="hunter-count">×${n}</span>`
          + `<span class="hunter-trait">${def.trait}</span></div>`;
      }).join('');
    }
    const next = world.wave + 1;
    const bossNext = next % 5 === 0 ? `<br><b>NEXT WAVE ${next} — THE UNDERSHEPHERD COMES</b>` : `<br>NEXT: WAVE ${next}`;
    els.manifestFoot.innerHTML = (world.veil
      ? `VEIL — <b>${world.veil.name}</b>: ${world.veil.desc}`
      : 'NO VEIL — the dark fights plain') + bossNext;
  }

  /** The loadout: every overclock fitted this run, with its stack count. */
  function renderLoadout(world) {
    const entries = Object.entries(world.fitted);
    const sig = entries.map(([k, n]) => `${k}:${n}`).join('|');
    if (sig === loadoutSig) return;
    loadoutSig = sig;
    els.loadoutCount.textContent = String(entries.reduce((a, [, n]) => a + n, 0));
    els.loadoutChips.innerHTML = entries.length === 0
      ? '<div class="panel-empty">None yet — clear a wave to fit one.</div>'
      : entries.map(([id, n]) => {
        const u = UPGRADES.find((x) => x.id === id);
        return `<span class="chip">${u ? u.name : id}${n > 1 ? ` <b>×${n}</b>` : ''}</span>`;
      }).join('');
  }

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
      els.overStats.textContent = `Wave ${world.wave} reached · ${world.kills} hollow burned · ${world.harvested} blooms harvested · best chain ×${(1 + world.bestCombo * 0.25).toFixed(2).replace(/\.?0+$/, '')} · best score ${Math.max(world.best, world.score).toLocaleString('en-US')}`;
      els.over.classList.add('show');
    },
    hideOver() { els.over.classList.remove('show'); },
    flashDamage() {
      els.vignette.classList.add('hit');
      setTimeout(() => els.vignette.classList.remove('hit'), 130);
    },
    setBloomTag(x, y, visible, bloom) {
      if (!visible) { els.bloomTag.style.opacity = '0'; return; }
      els.bloomTag.style.opacity = '1';
      els.bloomTag.style.transform = `translate(-50%, -130%) translate(${x}px, ${y}px)`;
      const sun = bloom.kind === 'sun';
      els.bloomTag.textContent = `${sun ? 'SUNBLOOM' : 'BLOOM'} ${bloom.inside}/${bloom.need}`;
      els.bloomTag.style.color = sun ? '#ffd34d' : '';
      els.bloomTag.style.borderColor = sun ? 'rgba(255, 211, 77, 0.55)' : '';
      els.bloomTag.classList.toggle('ready', bloom.inside >= bloom.need * 0.7);
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
      els.bestNum.textContent = Math.max(world.best, world.score).toLocaleString('en-US');
      renderManifest(world);
      renderLoadout(world);
      // The directive: the one thing the shepherd should do right now.
      const bossNow = world.hunters.find((h) => h.kind === 'undershepherd');
      if (bossNow) els.directive.textContent = `THE UNDERSHEPHERD — ${bossNow.ring ?? 0} MOTES HOLD IT · 18 TO BURN`;
      else if (world.bloom.active) els.directive.textContent = `${world.bloom.kind === 'sun' ? 'SUNBLOOM' : 'BLOOM'} OPEN — HOLD ${world.bloom.inside}/${world.bloom.need} MOTES INSIDE TO HARVEST`;
      else if (world.spawnQueue.length > 0) els.directive.textContent = `${world.spawnQueue.length} MORE HOLLOW AT THE RIM`;
      else if (world.hunters.length > 0) els.directive.textContent = `${world.hunters.length} HOLLOW ON THE FIELD — BURN THEM ALL`;
      else els.directive.textContent = 'THE RIM IS QUIET';
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
      if (boss) {
        els.bossFill.style.width = `${Math.max(0, (boss.hp / boss.hpMax) * 100)}%`;
        els.bossSub.textContent = (boss.ring ?? 0) >= 18
          ? `IT BURNS — ${boss.ring} MOTES HOLD IT`
          : `BURNS ONLY WHILE 18+ MOTES HOLD IT — NOW ${boss.ring ?? 0}`;
      }
      document.body.classList.toggle('lowhp', d.hp / d.hpMax < 0.3 && world.phase !== 'over');
    },
  };
}
