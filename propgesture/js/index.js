/* ==========================================================================
   PropGesture project page.
   Builds the video carousels/grids, handles lazy loading, per-panel audio
   and the prop selectors. No dependencies.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------- data ---- */

  var PROP_LABEL = {
    microphone: 'Microphone',
    phone: 'Mobile Phone',
    handfan: 'Hand Fan',
    dumbbell: 'Dumbbell',
    wineglass: 'Wine Glass',
    briefcase: 'Briefcase',
    umbrella: 'Umbrella',
    gun: 'Handgun',
    sword: 'Sword',
    pipe: 'Smoking Pipe'
  };

  // video/method/<stem>.mp4  and  video/mirrored/<stem>_mirrored.mp4
  var METHOD_STEM = {
    microphone: '2_scott_0_1_1_3_microphone',
    phone: '12_zhao_0_73_73_3_phone',
    handfan: '1_wayne_0_73_73_2_handfan',
    dumbbell: '11_nidal_0_87_87_8_dumbbell',
    wineglass: '10_kieks_0_5_5_4_wineglass',
    briefcase: '24_kexin_0_87_87_1_briefcase',
    umbrella: '13_lu_0_65_65_1_umbrella',
    gun: '13_lu_0_2_2_0_gun',
    sword: '5_stewart_0_87_87_0_sword',
    pipe: '1_wayne_0_87_87_4_pipe'
  };

  // video/comparison/<prop>/<stem>_<Method>.mp4
  var CMP_STEM = {
    briefcase: '4_lawrence_0_2_2_3',
    handfan: '6_carla_0_81_81_1',
    pipe: '20_li_0_1_1_7',
    gun: '12_zhao_0_87_87_3',
    phone: '13_lu_0_73_73_3',
    sword: '3_solomon_0_5_5_0',
    microphone: '3_solomon_0_7_7_6',
    dumbbell: '21_ayana_0_95_95_0',
    umbrella: '22_luqi_0_87_87_3',
    wineglass: '11_nidal_0_5_5_8'
  };

  var BASE = './video/';

  /* Inline SVG icons - the vendored FontAwesome bundle ships no webfonts,
     so icon fonts would render as empty boxes. */
  function svg(inner, extra) {
    return '<svg class="pg-icon' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" ' +
           'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
           'stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var ICONS = {
    muted: svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'),
    sound: svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'),
    prev: svg('<polyline points="15 18 9 12 15 6"/>'),
    next: svg('<polyline points="9 18 15 12 9 6"/>')
  };

  function methodSrc(prop, mirrored) {
    return mirrored
      ? BASE + 'mirrored/' + METHOD_STEM[prop] + '_mirrored.mp4'
      : BASE + 'method/' + METHOD_STEM[prop] + '.mp4';
  }
  function cmpSrc(prop, method) {
    return BASE + 'comparison/' + prop + '/' + CMP_STEM[prop] + '_' + method + '.mp4';
  }

  /* Carousel slides: one clip per prop, at the handedness listed below.
     `true` means the mirrored (left-hand) clip. */
  var CAROUSELS = {
    mediating: [
      [['microphone', false], ['phone', false]]
    ],
    compatible: [
      [['handfan', false], ['dumbbell', false]],
      [['wineglass', true], ['briefcase', false]],
      [['umbrella', false]]
    ],
    precluding: [
      [['gun', true], ['sword', true]],
      [['pipe', false]]
    ]
  };

  /* Prop-selector grids: fixed columns, sources swap with the selected prop. */
  var GRIDS = {
    comparison: {
      props: ['briefcase', 'handfan', 'pipe', 'gun', 'phone', 'sword'],
      cols: [
        { label: 'Ours', method: 'Ours', ours: true },
        { label: 'SynTalker', method: 'SynTalker' },
        { label: 'MECo', method: 'MECo' },
        { label: 'EMAGE LoRA', method: 'EMAGE_LoRA' },
        { label: 'DiffSHEG LoRA', method: 'DiffSHEG_LoRA' },
        { label: 'GestureLSM LoRA', method: 'GestureLSM_LoRA' }
      ],
      src: cmpSrc
    },
    ala: {
      props: ['microphone', 'dumbbell', 'umbrella', 'wineglass'],
      cols: [
        { label: 'Ours', method: 'Ours', ours: true },
        { label: 'Ours-DFT', method: 'Ours_DFT' },
        { label: 'Ours-LoRA', method: 'Ours_LoRA' }
      ],
      src: cmpSrc
    },
    am: {
      props: ['phone', 'dumbbell'],
      cols: [
        { label: 'Ours', method: 'Ours', ours: true },
        { label: 'Ours-AM', method: 'AM' }
      ],
      src: function (prop, method) { return BASE + 'ablation/' + prop + '_' + method + '.mp4'; }
    }
  };

  var DNO_PANELS = [
    { label: 'Ours w/o DNO-RF', file: 'RAW' },
    { label: 'DNO-RF', file: 'DNO', ours: true },
    { label: 'DNO-RF visualized', file: 'DNO_debug' }
  ];
  var DNO_STEM = '13_lu_0_111_111';

  /* ------------------------------------------------- video machinery ---- */

  var allVideos = [];

  function buildPanel(opts) {
    var panel = document.createElement('div');
    panel.className = 'pg-panel';

    var label = null;
    if (opts.label) {
      label = document.createElement('span');
      label.className = 'pg-panel-label' + (opts.ours ? ' is-ours' : '');
      label.textContent = opts.label;
    }

    var video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'none';
    video.disablePictureInPicture = true;
    if (opts.src) video.dataset.src = opts.src;

    var sound = document.createElement('button');
    sound.className = 'pg-sound';
    sound.type = 'button';
    sound.setAttribute('aria-label', 'Unmute this video');
    sound.innerHTML = ICONS.muted;
    sound.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleSound(video, sound);
    });

    if (label) panel.appendChild(label);
    panel.appendChild(video);
    panel.appendChild(sound);

    allVideos.push(video);
    return { panel: panel, video: video, label: label, sound: sound };
  }

  function toggleSound(video, button) {
    var turningOn = video.muted;
    // Only one soundtrack at a time.
    allVideos.forEach(function (v) {
      if (v !== video && !v.muted) {
        v.muted = true;
        var b = v.parentNode.querySelector('.pg-sound');
        if (b) { b.classList.remove('is-on'); b.innerHTML = ICONS.muted; }
      }
    });
    video.muted = !turningOn;
    button.classList.toggle('is-on', turningOn);
    button.innerHTML = turningOn ? ICONS.sound : ICONS.muted;
    button.setAttribute('aria-label', turningOn ? 'Mute this video' : 'Unmute this video');
    if (turningOn) safePlay(video);
  }

  function safePlay(video) {
    if (!video.src && video.dataset.src) load(video);
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked - ignore */ });
  }

  function load(video) {
    if (video.src || !video.dataset.src) return;
    video.src = video.dataset.src;
  }

  function setSrc(video, src) {
    if (video.dataset.src === src && video.src) return;
    video.dataset.src = src;
    if (video.src || video.dataset.live === '1') {
      var wasUnmuted = !video.muted;
      video.src = src;
      video.load();
      video.muted = !wasUnmuted;   // keep the soundtrack on across a prop switch
      safePlay(video);
    }
  }

  /* Play only what is on screen; load only what is near it. */
  var playObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var v = entry.target;
      if (entry.isIntersecting) {
        v.dataset.live = '1';
        load(v);
        if (!v.closest('.pg-slide') || v.closest('.pg-slide').dataset.active === '1') safePlay(v);
      } else {
        v.dataset.live = '0';
        v.pause();
      }
    });
  }, { rootMargin: '150px 0px', threshold: 0.1 });

  function observe(video) { playObserver.observe(video); }

  /* ---------------------------------------------------------- grids ---- */

  function buildGrid(container) {
    var spec = GRIDS[container.dataset.grid];
    if (!spec) return;
    var current = spec.props[0];
    var panels = spec.cols.map(function (col) {
      var p = buildPanel({
        label: col.label, ours: col.ours,
        src: spec.src(current, col.method)
      });
      container.appendChild(p.panel);
      observe(p.video);
      return p;
    });

    var chipBar = document.querySelector('[data-chips="' + container.dataset.grid + '"]');
    if (!chipBar) return;

    spec.props.forEach(function (prop, i) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pg-chip' + (i === 0 ? ' is-active' : '');
      chip.textContent = PROP_LABEL[prop];
      chip.addEventListener('click', function () {
        if (prop === current) return;
        current = prop;
        chipBar.querySelectorAll('.pg-chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        panels.forEach(function (p, j) {
          setSrc(p.video, spec.src(prop, spec.cols[j].method));
        });
      });
      chipBar.appendChild(chip);
    });
  }

  function buildDnoGrid(container) {
    DNO_PANELS.forEach(function (d) {
      var p = buildPanel({
        label: d.label, ours: d.ours,
        src: BASE + 'dnorf/' + DNO_STEM + '_' + d.file + '.mp4'
      });
      container.appendChild(p.panel);
      observe(p.video);
    });
  }

  /* ------------------------------------------------------- carousels ---- */

  function buildCarousel(root) {
    var slides = CAROUSELS[root.dataset.carousel];
    if (!slides) return;

    var viewport = document.createElement('div');
    viewport.className = 'pg-carousel-viewport';
    var track = document.createElement('div');
    track.className = 'pg-carousel-track';
    viewport.appendChild(track);

    var slideEls = slides.map(function (pair, i) {
      var slide = document.createElement('div');
      slide.className = 'pg-slide' + (pair.length === 1 ? ' pg-slide-single' : '');
      slide.dataset.active = i === 0 ? '1' : '0';
      pair.forEach(function (entry) {
        var prop = entry[0], mirrored = entry[1];
        var p = buildPanel({ src: methodSrc(prop, mirrored) });
        slide.appendChild(p.panel);
        observe(p.video);
      });
      track.appendChild(slide);
      return slide;
    });

    var prev = navButton('prev', 'Previous');
    var next = navButton('next', 'Next');

    var dots = document.createElement('div');
    dots.className = 'pg-dots';
    var dotEls = slides.map(function (_, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'pg-dot' + (i === 0 ? ' is-active' : '');
      d.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      d.addEventListener('click', function () { go(i); });
      dots.appendChild(d);
      return d;
    });

    if (slides.length > 1) root.appendChild(prev);
    root.appendChild(viewport);
    if (slides.length > 1) root.appendChild(next);
    if (slides.length > 1) root.appendChild(dots);

    var index = 0;
    function go(i) {
      index = Math.max(0, Math.min(slides.length - 1, i));
      track.style.transform = 'translateX(' + (-100 * index) + '%)';
      slideEls.forEach(function (s, k) {
        var active = k === index;
        s.dataset.active = active ? '1' : '0';
        s.querySelectorAll('video').forEach(function (v) {
          if (active) {
            load(v);
            if (v.dataset.live === '1') safePlay(v);
          } else {
            v.pause();
            if (!v.muted) {
              v.muted = true;
              var b = v.parentNode.querySelector('.pg-sound');
              if (b) { b.classList.remove('is-on'); b.innerHTML = ICONS.muted; }
            }
          }
        });
      });
      // Warm the neighbouring slide so the next click is instant.
      if (slideEls[index + 1]) slideEls[index + 1].querySelectorAll('video').forEach(load);
      if (slideEls[index - 1]) slideEls[index - 1].querySelectorAll('video').forEach(load);
      prev.disabled = index === 0;
      next.disabled = index === slides.length - 1;
      dotEls.forEach(function (d, k) { d.classList.toggle('is-active', k === index); });
    }

    prev.addEventListener('click', function () { go(index - 1); });
    next.addEventListener('click', function () { go(index + 1); });

    // Touch swipe.
    var startX = null;
    viewport.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
      startX = null;
    });

    go(0);
  }

  function navButton(kind, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pg-carousel-nav pg-carousel-' + kind;
    b.setAttribute('aria-label', label + ' slide');
    b.innerHTML = kind === 'prev' ? ICONS.prev : ICONS.next;
    return b;
  }

  /* ------------------------------------------------------------ init ---- */

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-carousel]').forEach(buildCarousel);
    document.querySelectorAll('[data-grid]').forEach(function (g) {
      if (g.dataset.grid === 'dno') buildDnoGrid(g);
      else buildGrid(g);
    });
  });
})();
