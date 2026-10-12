/* =========================================================================
   Adventure in Dream Land - scroll-driven scene controller.

   Scrolling is an INPUT, not a timeline. Each scroll delta is fed in as
   acceleration; the character carries its own momentum and coasts to a stop
   through damping. Nothing is mapped directly to scrollY, so there is no
   snapping - you push the character along and it keeps walking for a moment
   after you stop.

   Each scene is a COURSE: one or more walkable segments (flat, or sloped like
   a staircase), joined by jumps. Walking off the end of a segment launches a scripted
   parabolic jump to the next one; walking off the last segment launches a
   scripted scene transition (walk off, white out, swap background, walk back
   in from the far side). Both play out on their own clock and ignore scroll
   input until they land, so the character can never be left hanging mid-air.
   Everything works in both directions: scrolling up retraces the course.
   ========================================================================= */

(function () {
  'use strict';

  /* ----- the virtual screen ---------------------------------------------- */

  var VW = 240, VH = 160;          // world size in virtual pixels (3:2, = GBA)
  var NARR_H = 34;                 // narration band under the screen, same units

  /* ----- the sprite sheet ------------------------------------------------ */
  /* img/kirby_anim.png is a 32x26 cell grid lifted from the sheet:
       row 0 - idle, 2 frames  (line 1: stand + blink)
       row 1 - walk, 10 frames (line 5)
       row 2 - run,  8 frames  (line 6, frames 0-7; 8-10 are the skid-stop)
       row 3 - jump, 10 frames (line 4: 0 takeoff, 1-5 somersault, 6 coming
                                out of it, 7-8 falling, 9 landing squash)
       row 4 - puff, 8 frames  (line 8: inhaled and floating; the double jump)
       row 5 - float, 19 frames (line 12: turning to the camera, then spinning)
       row 6 - stretch, 9 frames (line 24: squashing flat and springing up)
     Cells are 26px tall so the puffed-up frames fit, and 32px wide so the
     flattest squash does; everything is centred across, and everything but the spin
     is bottom-aligned, so the feet sit on the cell's bottom row in every
     frame. The spin is centred in its cells, so it turns about its middle. */

  var CELL_W = 32, CELL_H = 26;
  var KIRBY_SCALE = 0.5;           // drawn size relative to the source sprite
  var HALF_W = 10 * KIRBY_SCALE;   // half the body's width (body is ~20px of 26)

  var IDLE = { row: 0, frames: 2 };
  // Stride lengths scale with the sprite, so the feet don't skate.
  var WALK = { row: 1, frames: 10, pxPerFrame: 3 };
  var RUN = { row: 2, frames: 8, pxPerFrame: 4 };
  var JUMP_ROW = 3;
  var PUFF_ROW = 4;                // line 8: puffed up with air, flapping
  var PUFF_FRAMES = 8;
  var PUFF_MS = 80;                // frame time of the flap

  var BLINK_PERIOD = 2800;         // ms between blinks while idling
  var BLINK_LENGTH = 150;          // ms the eyes stay shut
  var LAND_MS = 90;                // how long the landing squash is held
  var FALL_FLAP_MS = 90;           // frame time of the falling arm-flap

  /* The stretch, in the intro: line 24, played once when Kirby first walks
     into the middle of the scene. The narration waits for it, fades in as it
     starts and stays up. Kirby comes out of it standing still. [frame, ms] */
  var STRETCH_ROW = 6;
  var STRETCH_X = 120;             // the middle of the screen
  var STRETCH = [
    [0, 160], [1, 160], [2, 130], [3, 170], [4, 130], [5, 170], [6, 130],
    [7, 200], [8, 450]
  ];
  var CAPTION_FADE_MS = 700;

  /* The float-away, in the last scene: line 12 (Kirby turns to the camera
     and tumbles round and round). Once Kirby is FLOAT_AT of the way across,
     it lifts off and drifts up and away off the top of the screen, spinning,
     and the story ends. Row 5, centred in its cells since it spins. */
  var FLOAT_ROW = 5;
  var FLOAT_AT = 0.75;             // fraction of the way across the scene
  var FLOAT_MS = 3200;             // lift-off to gone
  var FLOAT_DRIFT = 40;            // px it drifts right on the way up
  var FLOAT_TOP = -24;             // feet height at the end: well off the top
  var FLOAT_INTRO = [[0, 140], [1, 160]];   // turning to the camera [frame, ms]
  var SPIN_FIRST = 2, SPIN_LAST = 16, SPIN_MS = 75;   // then this, looped

  /* ----- motion ---------------------------------------------------------- */

  /* Scroll feeds acceleration, acceleration feeds velocity, velocity feeds
     position - two integrations, so a single notch ramps the character up
     over several frames instead of snapping it to speed. Both accel and vel
     decay on their own, which is what makes it coast to a stop and settle
     into the idle when the input stops. */

  var ACCEL_GAIN = 0.003;          // acceleration added per px of scroll delta
  var ACCEL_DECAY = 0.82;          // acceleration retained per 60fps frame
  var MAX_ACCEL = 2.4;
  var DAMPING = 0.90;              // velocity retained per 60fps frame
  var MAX_VEL = 2.2;               // world px per frame
  var RUN_SPEED = 1.3;             // above this the run cycle takes over
  var MOVE_SPEED = 0.10;           // below this the character is idling
  var HYSTERESIS = 0.7;            // gate widths, so states can't flicker

  var GRAVITY = 420;               // world px / s^2, sets every jump's duration
  var LAND_DRIFT = 0.6;            // px/frame carried out of a landing

  /* ----- courses --------------------------------------------------------- */
  /* All x values are where the character's FEET are, horizontally centred;
     all y values are the height its feet stand at. Both in world px.

     segs   walkable spans, each a polyline of [x, y] points - two points for a
            flat floor, more for stairs or slopes; the feet follow it linearly.
            Walking past the last point of the last segment advances the story,
            past the first point of the first rewinds it. Walking off either
            end of any other segment jumps to the neighbouring one.
     jumps  jumps[i] joins segs[i] and segs[i+1]:
              land      where a forward jump touches down on segs[i+1]
              landBack  where a backward jump touches down on segs[i]
              rise      apex height above the higher of the two ends; 0
                        makes it a DROP (walk off the edge and fall)
              riseBack  the same for the backward direction (default: rise)
              double    make the forward jump a double jump (see beginJump)
              doubleBack  the same backwards (default: same as double)
              multi / multiBack  a hop and then several puffs through given
                        points, for climbs too high for one jump (see beginJump)
            Landing points sit a few px inside the segment, so the first
            nudge the other way can't bounce straight back off the edge.
     enterFwd / enterBack  where a scene transition walks the character to
            when arriving from the left / from the right. */

  var LEFT_EDGE = 14;
  var RIGHT_EDGE = VW - 14;

  /* img/china.png, measured off the 2528x1696 source and scaled to 240x160:
       left pagoda ledge   x   0-45   top 69.3
       floating platform 1 x  77-115  top 55.8
       floating platform 2 x 117-156  top 39.6
       right ledge         x 187-240  top 87.5
     Platform 2 starts right where 1 ends but higher, so platform 1's segment
     stops short enough that the character's head stays clear of 2's underside,
     and the 1 -> 2 jump is steep enough to clear 2's corner on the way up. */
  var CHINA = {
    segs: [
      [[5, 69.3], [40, 69.3]],         // left pagoda ledge (enter here)
      [[82, 55.8], [104, 55.8]],       // floating platform 1
      [[124, 39.6], [148, 39.6]],      // floating platform 2
      [[193, 87.5], [RIGHT_EDGE, 87.5]] // right ledge (leave from here)
    ],
    jumps: [
      { land: 90, landBack: 30, rise: 10 },
      { land: 132, landBack: 96, rise: 10 },
      { land: 201, landBack: 140, rise: 10,
        // back up from the right ledge: a hop and two puffs along the same arc
        // the single jump took (apex 10 above platform 2, which clears its corner)
        multiBack: { along: 10, puffs: 2, bump: 0.5, floaty: 1 } }
    ],
    enterFwd: 18,
    enterBack: 212
  };

  /* img/taiwan.png, same scaling:
       scooter ledge  x  0-40   top 109.9  (the blue scooter's stone wall)
       staircase      (40, 109.9) down to (68, 137.3), ~45 degrees, along the
                      step nosings
       street         x 68-240  top 137.3  (in front of the shops and canal)
     The street is split just past the noodle shop (its awning ends ~x 133)
     so there's a hop there: same height both ends, so a symmetric arc. */
  var TAIWAN = {
    segs: [
      [[5, 109.9], [40.5, 109.9], [68, 137.3], [136, 137.3]],
      [[150, 137.3], [RIGHT_EDGE, 137.3]]
    ],
    jumps: [
      { land: 160, landBack: 128, rise: 14 }
    ],
    enterFwd: 20,
    enterBack: RIGHT_EDGE - 30
  };

  /* img/intro.png: walking IN the grass. Its front row of blades (tips ~123,
     cut out as img/intro_grass.png and drawn over the character) hides the
     feet, so 125 puts them just down among the blade tips.
     The last scene ("Now...") reuses the same painting and grass. */
  function straight(y) {
    return {
      segs: [[[LEFT_EDGE, y], [RIGHT_EDGE, y]]],
      jumps: [],
      enterFwd: LEFT_EDGE + 30,
      enterBack: RIGHT_EDGE - 30
    };
  }
  var INTRO = straight(125);
  INTRO.stretch = true;            // stretches mid-screen first (see STRETCH)
  var NOW = straight(125);
  NOW.floatAway = true;            // floats off three quarters of the way across (see FLOAT_AT)

  /* img/korea_elementary.png: starts up on the floating brick blocks.
       block 1 (leftmost)  x   0-22   top 61.6  (bottom 70.8)
       block 2             x  58-86   top 36.0  (bottom 45.3)
       block 3 (centre)    x  99-142  top 55.0  (bottom 64.4)
       ground              dirt strip in front of the gate, 140.6
     Forward: double jump 1 -> 2 (the puff comes early and fast: a boost, not
     a float), drop 2 -> 3, drop 3 -> ground, walk on.
     Backward each has to go UP instead, so those arcs are separate. Ground ->
     block 3 is an 85px climb, so it's a hop and four puffs, placed along the
     one big parabola a single jump would take (apex 15 above the block). The
     ground starts well right of the block (185) so that parabola is wide and
     round rather than a near-vertical climb, and it clears the block's right
     corner with room to spare - no arc passes through a block. */
  var KOREA = {
    segs: [
      [[5, 61.6], [18, 61.6]],             // block 1 (enter here)
      [[62, 36.0], [86, 36.0]],            // block 2 (drop from its very edge)
      [[103, 55.0], [141, 55.0]],         // block 3 (likewise)
      [[185, 140.6], [RIGHT_EDGE, 140.6]]  // the ground (leave from here)
    ],
    jumps: [
      { land: 70, landBack: 12, rise: 12, riseBack: 6,
        double: { span: 30, cut: 0.25, rise2: 8, floaty: 1 }, doubleBack: null },
      { land: 110, landBack: 76, rise: 0, riseBack: 8 },
      { land: 193, landBack: 128, rise: 0,
        multiBack: { along: 15, puffs: 4, bump: 0.5, floaty: 1 } }
    ],
    enterFwd: 11,
    enterBack: RIGHT_EDGE - 14
  };

  /* img/cambodia.png: along the front, where the plaza floor meets the stone
     wall's cap, and over the lotus pond in the middle (its stone frame spans
     x 74.5-165.5): a hop from right at the pond's edge, then three short puffs
     across, each about a quarter of the way, never more than ~16px up. */
  var CAMBODIA = {
    segs: [
      [[LEFT_EDGE, 137.5], [72, 137.5]],
      [[170, 137.5], [RIGHT_EDGE, 137.5]]
    ],
    jumps: [
      { land: 178, landBack: 64,
        multi: { points: [[98, 126, 10], [124, 123, 6], [150, 125, 6]], rise: 6, floaty: 0.7 },
        multiBack: { points: [[144, 126, 10], [118, 123, 6], [92, 125, 6]], rise: 6, floaty: 0.7 } }
    ],
    enterFwd: LEFT_EDGE + 30,
    enterBack: RIGHT_EDGE - 30
  };

  /* img/korea.png ("Back to Korea"): starts up on the second-level walkway in
     front of the upper Olive Young (floor 96.0), then jumps over its railing
     where it ends, at the end of musinsa standard (end post x 120.4, top rail
     87.0), down to the street sidewalk (148.0, mid-paving) and walks on.
     Forward: take-off far enough back (108) that the feet are already over the
     top rail when the body reaches the post. Backward: a 54px climb up and
     over the railing, so a hop and three puffs along one parabola that peaks
     22 above the walkway - lower and it grazes the post. */
  var KOREA_BACK = {
    segs: [
      [[5, 96.0], [108, 96.0]],              // second-level walkway (enter here)
      [[145, 148.0], [RIGHT_EDGE, 148.0]]    // the sidewalk (leave from here)
    ],
    jumps: [
      { land: 152, landBack: 100, rise: 16,
        multiBack: { along: 22, puffs: 3, bump: 0.5, floaty: 1 } }
    ],
    enterFwd: 30,
    enterBack: RIGHT_EDGE - 14
  };

  var COURSES = [INTRO, CHINA, TAIWAN, KOREA, CAMBODIA, KOREA_BACK, NOW];
  var SCENES = COURSES.length;

  // Just fully off-screen on each side, so walking off and walking in cover
  // the same distance in both directions.
  var OFF_LEFT = -HALF_W - 2;
  var OFF_RIGHT = VW + HALF_W + 2;

  function segStart(pts) { return pts[0][0]; }
  function segEnd(pts) { return pts[pts.length - 1][0]; }

  // Feet height along a segment at x, clamped flat past either end (so the
  // walk on/off screen during a transition stays level).
  function heightAt(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        var a = pts[i - 1], b = pts[i];
        return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      }
    }
    return pts[pts.length - 1][1];
  }

  /* ----- the scene transition, in ms ------------------------------------- */
  /* Scripted and scroll-independent: once it starts it plays out on its own
     clock. Timings are cumulative from the start of the transition. */

  var T_OUT = 800;                 // walking off the edge
  var T_SWAP = 800;                // background swaps here, under full white
  var T_IN_START = 1040;           // starts walking in from the far side
  var T_DONE = 2190;               // control returns to the scroll
  var WHITE_UP = [250, 800];       // white fades 0 -> 1 across this window
  var WHITE_DOWN = [1100, 1560];   // and 1 -> 0 across this one

  /* ----- elements -------------------------------------------------------- */

  var root = document.documentElement;
  var kirby = document.getElementById('kirby');
  var flash = document.getElementById('flash');
  var ending = document.getElementById('ending');
  var startCard = document.getElementById('start');
  var startBtn = document.getElementById('startBtn');
  var replayBtn = document.getElementById('replay');
  var hint = document.getElementById('hint');
  var fill = document.getElementById('progressFill');
  var bgs = [].slice.call(document.querySelectorAll('.bg'));
  var fgs = [].slice.call(document.querySelectorAll('.fg'));
  var caps = [].slice.call(document.querySelectorAll('.narration .caption'));

  /* ----- helpers --------------------------------------------------------- */

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function ramp(t, a, b) { return clamp01((t - a) / (b - a)); }

  /* ----- sizing ---------------------------------------------------------- */

  // Fit the 3:2 screen plus the narration band under it into ~92% of the
  // viewport, and snap the scale to a whole number where there is room for it
  // so the pixel art stays crisp. The leftover viewport is the black border.
  // Below 2x we keep the fractional scale, otherwise phones would get a
  // postage stamp.
  function resize() {
    var screen = document.getElementById('screen');
    var scale = Math.min(window.innerWidth * 0.92 / VW,
                         window.innerHeight * 0.92 / (VH + NARR_H));
    if (scale >= 2) scale = Math.floor(scale);

    screen.style.width = (VW * scale) + 'px';
    screen.style.height = (VH * scale) + 'px';
    root.style.setProperty('--px', scale);
  }

  /* ----- scroll as an impulse source ------------------------------------- */

  // We never read an absolute scroll position, only the delta since the last
  // event, and we quietly recentre the page inside its track whenever it drifts
  // towards either end. That keeps native scrolling (wheel, trackpad, keyboard,
  // touch) working forever without ever calling preventDefault.

  var impulse = 0;
  var lastScrollY = 0;

  // A transition swallows the rest of the scroll gesture that triggered it:
  // trackpad momentum and a still-spinning wheel keep producing deltas for a
  // second or more, and without this they'd shove the character across the new
  // scene the moment control came back. Input counts again once the scroll
  // has been quiet for QUIET_MS - or, at the latest, SWALLOW_MAX_MS after
  // control came back. Without that cap, scrolling that never pauses (a wheel
  // kept spinning, or a trackpad's momentum) was swallowed indefinitely, and
  // Kirby stood still until a click stopped the momentum.
  var QUIET_MS = 200;
  var SWALLOW_MAX_MS = 500;
  var swallowFrom = null;          // when control came back with swallowing on
  var HINT_IDLE_MS = 1500;         // the scroll hint comes back after this long without input
  var lastInputAt = -Infinity;
  var swallowing = false;

  function scrollLimit() {
    return Math.max(1, root.scrollHeight - window.innerHeight);
  }

  function recentre() {
    var mid = Math.round(scrollLimit() / 2);
    lastScrollY = mid;             // set first: our own scrollTo fires onScroll
    window.scrollTo(0, mid);
  }

  function onScroll() {
    var y = window.scrollY;
    var d = y - lastScrollY;
    lastScrollY = y;
    if (d === 0) return;           // our own recentre: not input
    impulse += d;
  }

  /* ----- state ----------------------------------------------------------- */

  var scene = 0;
  var seg = 0;                     // index into COURSES[scene].segs
  var x = COURSES[0].enterFwd;
  var y = heightAt(COURSES[0].segs[0], x);
  var accel = 0;
  var vel = 0;
  var facing = 1;
  var travelled = 0;               // total distance walked, drives the cycle
  var anim = IDLE;
  var landUntil = 0;               // hold the landing squash until this time

  var phase = 'title';             // 'title' | 'travel' | 'jump' | 'stretch' | 'float' | 'transition' | 'ended'

  // stretch bookkeeping: once per play-through
  var stretchT = 0;
  var stretchedAt = null;          // when it started (the intro caption fades in from here)

  // float-away bookkeeping
  var floatT = 0, floatX0 = 0, floatY0 = 0;

  // jump bookkeeping: x is linear in u, y is the parabola apexY + jA(u - jU)^2
  var jT = 0, jDur = 0, jDir = 1, jToSeg = 0;
  var jX0 = 0, jX1 = 0, jApexY = 0, jA = 0, jU = 0;
  var jEndU = 1;                   // where this arc stops (< 1: cut short for the puff)
  var jStage = 0;                  // 0 single jump, 1 the hop before puffs, 2 puffing
  var jQueue = [];                 // puff arcs still to come, each starting where the last ended
  var jDrop = false;               // walked off an edge: falling only, no rise

  // transition bookkeeping
  var tT = 0, tSwapped = false, tDir = 1;
  var tExitFrom = 0, tExitTo = 0, tEnterFrom = 0, tEnterTo = 0;
  var tNextScene = null;           // scene to switch to at the swap, or null
  var tPark = false;               // stay off-screen afterwards (the ending)
  var tShowEnding = false, tHideEnding = false;

  /* ----- the animation state machine ------------------------------------- */

  // Chosen from actual speed rather than from the raw input, so the scripted
  // transition walk picks a sensible cycle too. The gates overlap so a speed
  // hovering on a boundary can't strobe between two cycles.
  function pickAnim(speed) {
    if (anim === RUN) {
      if (speed < RUN_SPEED * HYSTERESIS) anim = WALK;
    } else if (speed > RUN_SPEED) {
      anim = RUN;
    }

    if (anim !== RUN) {
      if (anim === IDLE) {
        if (speed > MOVE_SPEED / HYSTERESIS) anim = WALK;
      } else if (speed < MOVE_SPEED) {
        anim = IDLE;
      }
    }
    return anim;
  }

  // Which jump frame to show at progress u (0 take-off .. 1 touch-down): the
  // stretched take-off pose while launching, the somersault spread across the
  // top of the arc, then the arm-flapping fall.
  function jumpFrame(u, now) {
    // A drop is just the end of a jump: upright falling, 7 then 8, and the
    // usual landing squash (9) when it touches down.
    if (jDrop) return u < 0.5 ? 7 : 8;
    var flipStart = 0.3 * jU;
    var flipEnd = jU + 0.35 * (jEndU - jU);
    if (u < flipStart) return 0;
    if (u < flipEnd) return 1 + Math.min(5, Math.floor((u - flipStart) / (flipEnd - flipStart) * 6));
    // The first hop of a double jump doesn't flap: it drops into frame 7 and
    // then holds frame 8 - the "about to land" pose - right up to the puff.
    if (jStage === 1) return u < (flipEnd + jEndU) / 2 ? 7 : 8;
    return 7 + Math.floor(now / FALL_FLAP_MS) % 2;
  }

  function drawSprite(now) {
    var row, frame;
    if (phase === 'stretch') {
      row = STRETCH_ROW;
      frame = stretchStep()[0];
    } else if (phase === 'float') {
      row = FLOAT_ROW;
      frame = floatFrame();
    } else if (phase === 'jump' && jStage === 2) {
      row = PUFF_ROW;
      frame = Math.floor(jT / PUFF_MS) % PUFF_FRAMES;
    } else if (phase === 'jump') {
      row = JUMP_ROW;
      frame = jumpFrame(clamp01(jT / jDur), now);
    } else if (now < landUntil) {
      row = JUMP_ROW;
      frame = 9;                   // landing squash
    } else if (anim === IDLE) {
      // Time-driven: eyes open most of the cycle, shut briefly.
      row = IDLE.row;
      frame = (now % BLINK_PERIOD) < BLINK_LENGTH ? 1 : 0;
    } else {
      // Distance-driven, so the feet stay locked to the ground at any speed.
      row = anim.row;
      frame = Math.floor(travelled / anim.pxPerFrame) % anim.frames;
    }
    kirby.style.backgroundPosition = (-frame * CELL_W) + 'px ' + (-row * CELL_H) + 'px';
  }

  /* ----- scene presentation ---------------------------------------------- */

  function showScene(i) {
    for (var n = 0; n < SCENES; n++) bgs[n].style.opacity = n === i ? 1 : 0;
    fgs.forEach(function (el) { el.style.opacity = +el.dataset.scene === i ? 1 : 0; });
  }

  function updateCaptions(frac, visible, now) {
    // Symmetric band: fades in off either edge and out towards either edge, so
    // it reads the same whether the scene was entered forwards or backwards.
    var a = visible ? smooth(frac / 0.14) * (1 - smooth((frac - 0.86) / 0.14)) : 0;
    // The intro's line instead waits for the stretch, fades in as it starts
    // and then stays up, only fading as Kirby walks off the right.
    if (COURSES[scene].stretch) {
      a = visible && stretchedAt !== null
        ? smooth((now - stretchedAt) / CAPTION_FADE_MS) * (1 - smooth((frac - 0.86) / 0.14))
        : 0;
    }
    for (var n = 0; n < SCENES; n++) {
      caps[n].style.opacity = n === scene ? a : 0;
    }
  }

  /* ----- jumps ----------------------------------------------------------- */

  // A clean ballistic arc: constant horizontal speed, constant gravity, so the
  // path is an exact parabola through take-off, apex and landing. With the apex
  // height above each end D0 / D1, the time to rise is sqrt(2 D0 / g) and to
  // fall sqrt(2 D1 / g), which fixes both the duration and where in it the
  // apex falls (jU).
  function setArc(x0, y0, x1, y1, apexY, g) {
    jX0 = x0; jX1 = x1; jApexY = apexY;
    var s0 = Math.sqrt(y0 - apexY), s1 = Math.sqrt(y1 - apexY);
    jU = s0 / (s0 + s1);
    jA = (s0 + s1) * (s0 + s1);
    jDur = Math.sqrt(2 / g) * (s0 + s1) * 1000;
    jT = 0;
  }

  function beginJump(dir) {
    var course = COURSES[scene];
    var j = dir > 0 ? course.jumps[seg] : course.jumps[seg - 1];
    jToSeg = seg + dir;
    jDir = dir;
    var xLand = dir > 0 ? j.land : j.landBack;
    var yLand = heightAt(course.segs[jToSeg], xLand);
    var rise = dir > 0 || j.riseBack === undefined ? j.rise : j.riseBack;
    var dbl = dir > 0 || j.doubleBack === undefined ? j.double : j.doubleBack;
    var mul = dir > 0 ? j.multi : j.multiBack;
    jDrop = rise === 0 && !dbl && !mul;
    jQueue = [];

    if (mul) {
      /* Multi-puff climb: a hop to the first point, then one puff per point
         after it and a last puff to the landing. Each point is reached on the
         way DOWN its arc (apex `rise` above the higher end), so every puff
         fires from the about-to-land pose, like the double jump's.
         With `along`, the points aren't given: the climb follows the single
         big parabola from here to the landing (apex `along` above the
         landing). `puffs` points sit on its rising side, evenly spaced by
         distance ALONG the curve (equal heights would bunch them into the
         steep bottom, where Kirby climbs fastest), each a `bump` above the next.
         The last puff peaks at the big curve's own apex, which makes it that
         same stretch of the big curve exactly (and so it clears whatever the
         big curve clears). */
      var pts = mul.points, g = GRAVITY * (mul.floaty || 1), lastRise = mul.rise;
      if (mul.along !== undefined) {
        var bigApex = Math.min(y, yLand) - mul.along;
        var b0 = Math.sqrt(y - bigApex), b1 = Math.sqrt(yLand - bigApex);
        var bU = b0 / (b0 + b1), bA = (b0 + b1) * (b0 + b1), sx = x, sy = y;
        var bx = function (u) { return sx + (xLand - sx) * u; };
        var by = function (u) { return bigApex + bA * (u - bU) * (u - bU); };
        // cumulative length of the rising side (take-off .. apex), sampled
        var N = 200, len = [0];
        for (var q = 1; q <= N; q++) {
          var ua = bU * (q - 1) / N, ub = bU * q / N;
          len.push(len[q - 1] + Math.hypot(bx(ub) - bx(ua), by(ub) - by(ua)));
        }
        pts = [];
        for (var k2 = 1, q2 = 0; k2 <= mul.puffs; k2++) {
          var want = len[N] * k2 / (mul.puffs + 1);
          while (len[q2 + 1] < want) q2++;
          var uu = bU * (q2 + (want - len[q2]) / (len[q2 + 1] - len[q2])) / N;
          pts.push([bx(uu), by(uu), mul.bump]);
        }
        lastRise = Math.min(pts[pts.length - 1][1], yLand) - bigApex;
      }
      setArc(x, y, pts[0][0], pts[0][1], Math.min(y, pts[0][1]) - pts[0][2], GRAVITY);
      jEndU = 1;
      for (var k = 1; k <= pts.length; k++) {
        var from = pts[k - 1], to = k < pts.length ? pts[k] : [xLand, yLand, lastRise];
        jQueue.push({ x0: from[0], y0: from[1], x1: to[0], y1: to[1],
                      apexY: Math.min(from[1], to[1]) - to[2], g: g });
      }
      jStage = 1;
    } else if (dbl) {
      /* Double jump (Kirby inhales and floats the rest of the way):
           hop  - a normal arc aimed `span` px ahead at take-off height, cut
                  short `cut` of the way down its fall, in the about-to-land pose;
           puff - from that point, a fresh arc `rise2` above it to the real
                  landing, under `floaty` x gravity so it drifts. */
      var D = dbl;
      var vx1 = x + dir * D.span;
      setArc(x, y, vx1, y, y - rise, GRAVITY);
      var yCut = jApexY + D.cut * (y - jApexY);
      jEndU = jU + Math.sqrt((yCut - jApexY) / jA);
      var xCut = jX0 + (jX1 - jX0) * jEndU;
      jQueue.push({ x0: xCut, y0: yCut, x1: xLand, y1: yLand,
                    apexY: Math.min(yCut, yLand) - D.rise2, g: GRAVITY * D.floaty });
      jStage = 1;
    } else {
      // (a drop has rise 0: the apex is the edge it walked off, so it only falls)
      setArc(x, y, xLand, yLand, Math.min(y, yLand) - rise, GRAVITY);
      jEndU = 1; jStage = 0;
    }

    phase = 'jump';
    accel = 0;
    vel = 0;
    impulse = 0;
    facing = dir;
  }

  function stepJump(dt, now) {
    jT += dt;
    var u = Math.min(jT / jDur, jEndU);
    x = jX0 + (jX1 - jX0) * u;
    y = jApexY + jA * (u - jU) * (u - jU);

    if (u >= jEndU && jQueue.length) {
      // a puff: launch the next arc from exactly where the last one ended
      var n = jQueue.shift();
      setArc(n.x0, n.y0, n.x1, n.y1, n.apexY, n.g);
      jEndU = 1; jStage = 2;
      return;
    }

    if (u >= 1) {
      seg = jToSeg;
      y = heightAt(COURSES[scene].segs[seg], x);   // exact, no float drift
      phase = 'travel';
      jStage = 0;
      jDrop = false;
      landUntil = now + LAND_MS;
      accel = 0;
      impulse = 0;
      vel = jDir * LAND_DRIFT;          // drift a touch further onto the platform
    }
  }

  /* ----- the stretch ---------------------------------------------------- */

  // Scripted, like a jump: scroll can't cut it short. Kirby comes out of it
  // standing, and the rest of the scroll that walked it there is swallowed
  // like a transition's, so it doesn't run straight off afterwards.
  function beginStretch(now) {
    phase = 'stretch';
    stretchT = 0;
    stretchedAt = now;
    swallowing = true;
    accel = 0;
    vel = 0;
    impulse = 0;
  }

  function stretchStep() {
    for (var i = 0, t = stretchT; i < STRETCH.length; i++) {
      if (t < STRETCH[i][1]) return STRETCH[i];
      t -= STRETCH[i][1];
    }
    return null;
  }

  function stepStretch(dt) {
    stretchT += dt;
    if (stretchStep()) return;
    phase = 'travel';
    impulse = 0;
  }

  /* ----- the float-away ------------------------------------------------ */

  // Scripted, like a jump: scroll can't steer it. When Kirby is out of sight
  // the ending plays, the same white-out a walk off the last scene gives.
  function beginFloat() {
    phase = 'float';
    floatT = 0;
    floatX0 = x;
    floatY0 = y;
    facing = 1;
    accel = 0;
    vel = 0;
    impulse = 0;
  }

  function floatFrame() {
    var t = floatT;
    for (var i = 0; i < FLOAT_INTRO.length; i++) {
      if (t < FLOAT_INTRO[i][1]) return FLOAT_INTRO[i][0];
      t -= FLOAT_INTRO[i][1];
    }
    return SPIN_FIRST + Math.floor(t / SPIN_MS) % (SPIN_LAST - SPIN_FIRST + 1);
  }

  function stepFloat(dt) {
    floatT += dt;
    var u = clamp01(floatT / FLOAT_MS);
    // Eases up off the ground like something lighter than air, then keeps
    // rising; the drift to the right levels off as it goes.
    x = floatX0 + FLOAT_DRIFT * (1 - (1 - u) * (1 - u));
    y = floatY0 + (FLOAT_TOP - floatY0) * u * u;
    if (u >= 1) beginTransition(1, null, { skipExit: true, park: true, showEnding: true });
  }

  /* ----- the scripted scene transition ----------------------------------- */

  /* dir  +1 walks off the right and back in from the left (story advances)
          -1 walks off the left and back in from the right (story rewinds)
     opts.skipExit   already off-screen, so skip the walk-off
     opts.park       stay off-screen afterwards and land in the 'ended' phase
     opts.showEnding / opts.hideEnding  toggled at the swap, under full white */
  function beginTransition(dir, nextScene, opts) {
    opts = opts || {};
    phase = 'transition';
    tT = 0;
    tSwapped = false;
    tDir = dir;
    tNextScene = nextScene;
    tPark = !!opts.park;
    tShowEnding = !!opts.showEnding;
    tHideEnding = !!opts.hideEnding;

    tExitTo = dir > 0 ? OFF_RIGHT : OFF_LEFT;
    tExitFrom = opts.skipExit ? tExitTo : x;
    tEnterFrom = dir > 0 ? OFF_LEFT : OFF_RIGHT;
    tEnterTo = 0;                  // decided at the swap, from the new course

    accel = 0;
    vel = 0;
    impulse = 0;
    facing = dir;
    swallowing = true;
  }

  function stepTransition(dt) {
    tT += dt;

    // Everything that would be jarring to see happens while the screen is white,
    // including the jump to the new course's height.
    if (!tSwapped && tT >= T_SWAP) {
      tSwapped = true;
      if (tNextScene !== null) {
        scene = tNextScene;
        showScene(scene);
        var course = COURSES[scene];
        seg = tDir > 0 ? 0 : course.segs.length - 1;
        tEnterTo = tDir > 0 ? course.enterFwd : course.enterBack;
      }
      if (tShowEnding) {
        ending.style.opacity = 1;
        ending.classList.add('is-on');
      }
      if (tHideEnding) {
        ending.style.opacity = 0;
        ending.classList.remove('is-on');
      }
    }

    // Position: walk off, wait out the white, walk back in from the far side.
    if (tT < T_OUT) {
      x = tExitFrom + (tExitTo - tExitFrom) * (tT / T_OUT);
    } else if (tT < T_IN_START || tPark) {
      x = tExitTo;                 // parked off-screen
    } else {
      x = tEnterFrom + (tEnterTo - tEnterFrom) *
        clamp01((tT - T_IN_START) / (T_DONE - T_IN_START));
    }
    y = heightAt(COURSES[scene].segs[seg], x);

    flash.style.opacity =
      smooth(ramp(tT, WHITE_UP[0], WHITE_UP[1])) *
      (1 - smooth(ramp(tT, WHITE_DOWN[0], WHITE_DOWN[1])));

    if (tT >= T_DONE) {
      if (tPark) {
        phase = 'ended';
      } else {
        phase = 'travel';
        x = tEnterTo;
        accel = 0;
        impulse = 0;
        // Hand over still walking at the entry pace rather than from a dead
        // stop, so there's no one-frame idle blip; damping then lets it drift
        // a few px further in and settle.
        vel = (tEnterTo - tEnterFrom) / ((T_DONE - T_IN_START) / (1000 / 60));
      }
    }
  }

  // The start card's button (or any key) begins the story - and, being a
  // real press, lets the music start with it.
  function start() {
    if (phase !== 'title') return;
    phase = 'travel';
    impulse = 0;
    startCard.classList.remove('is-on');
    tryPlay();
  }

  function replay() {
    if (phase !== 'ended') return;
    // Already off the right edge, so there is nothing to walk off: flash, put
    // the first scene back up and walk in from the left as usual.
    beginTransition(1, 0, { skipExit: true, hideEnding: true });
    stretchedAt = null;            // a fresh play-through stretches again
  }

  /* ----- main loop ------------------------------------------------------- */

  var lastNow = 0;
  var lastX = x;

  function frame(now) {
    var dt = lastNow ? Math.min(now - lastNow, 50) : 16.7;
    lastNow = now;
    var f = dt / (1000 / 60);      // elapsed time in 60fps-frame units

    // Timed on the frame clock, the same one everything else here runs on.
    if (impulse !== 0) lastInputAt = now;
    if (phase === 'travel' && swallowing) {
      if (swallowFrom === null) swallowFrom = now;
      if (now - lastInputAt > QUIET_MS || now - swallowFrom > SWALLOW_MAX_MS) {
        swallowing = false;
        swallowFrom = null;
      } else {
        impulse = 0;               // still the gesture that started the transition
      }
    }

    if (phase === 'travel') {
      // Scroll delta -> acceleration -> velocity -> position.
      accel += impulse * ACCEL_GAIN;
      impulse = 0;
      accel *= Math.pow(ACCEL_DECAY, f);
      if (accel > MAX_ACCEL) accel = MAX_ACCEL;
      if (accel < -MAX_ACCEL) accel = -MAX_ACCEL;

      vel += accel * f;
      vel *= Math.pow(DAMPING, f);
      if (vel > MAX_VEL) vel = MAX_VEL;
      if (vel < -MAX_VEL) vel = -MAX_VEL;

      x += vel * f;

      var course = COURSES[scene], pts = course.segs[seg];
      if (course.stretch && stretchedAt === null && x >= STRETCH_X) {
        x = STRETCH_X;
        beginStretch(now);
      }
      var floatX = LEFT_EDGE + FLOAT_AT * (RIGHT_EDGE - LEFT_EDGE);
      if (course.floatAway && x >= floatX) {
        x = floatX;
        beginFloat();
      }
      var last = course.segs.length - 1;

      if (x >= segEnd(pts)) {
        x = segEnd(pts);
        if (seg < last) beginJump(1);
        else if (scene === SCENES - 1) beginTransition(1, null, { park: true, showEnding: true });
        else beginTransition(1, scene + 1);
      } else if (x <= segStart(pts)) {
        x = segStart(pts);
        if (seg > 0) beginJump(-1);
        else if (scene === 0) { vel = 0; accel = 0; }   // nothing to rewind into
        else beginTransition(-1, scene - 1);
      }
      if (phase === 'travel' || phase === 'stretch') y = heightAt(pts, x);   // follow stairs and slopes

    } else {
      impulse = 0;                 // scroll can't steer a jump, the stretch, the float, a transition or the end
      if (phase === 'jump') stepJump(dt, now);
      else if (phase === 'stretch') stepStretch(dt);
      else if (phase === 'float') stepFloat(dt);
      else if (phase === 'transition') stepTransition(dt);
    }

    // The transition teleports the character from off one edge to off the
    // other. That is not motion: left unguarded it reads as a huge backwards
    // step and flips the sprite into a one-frame reversed sprint.
    var dx = x - lastX;
    lastX = x;
    if (Math.abs(dx) > 20) dx = 0;

    var speed = f > 0 ? Math.abs(dx) / f : 0;
    travelled += Math.abs(dx);

    if (dx > 0.01) facing = 1;
    else if (dx < -0.01) facing = -1;

    pickAnim(speed);
    drawSprite(now);

    // Place the cell so its bottom-centre (the pivot) sits on the feet.
    kirby.style.transform =
      'translate(' + (x - CELL_W / 2).toFixed(2) + 'px,' + (y - CELL_H).toFixed(2) + 'px) ' +
      'scale(' + (facing * KIRBY_SCALE) + ',' + KIRBY_SCALE + ')';

    var frac = clamp01((x - LEFT_EDGE) / (RIGHT_EDGE - LEFT_EDGE));
    // The float drifts right, but the narration stays put until the white-out.
    updateCaptions(phase === 'float' ? FLOAT_AT : frac,
                   phase === 'travel' || phase === 'jump' || phase === 'stretch' ||
                   phase === 'float', now);
    fill.style.width = (((scene + frac) / SCENES) * 100).toFixed(2) + '%';
    // The hint is up whenever the intro is waiting for input: not right after
    // a scroll, and not mid-transition, except that coming into the intro it
    // fades in with the scene as the white clears.
    var hintOn = 0;
    if (fontReady && scene === 0 && now - lastInputAt > HINT_IDLE_MS) {
      if (phase === 'travel') hintOn = 1;
      else if (phase === 'transition' && tSwapped) hintOn = 1 - flash.style.opacity;
    }
    hint.style.opacity = hintOn;

    // Keep room to scroll in both directions, without ever blocking the page.
    // Runs in every phase: scroll events still arrive during a transition, and
    // if the position were left parked against an end the next push would be
    // swallowed by the browser instead of reaching us.
    var sy = window.scrollY, limit = scrollLimit();
    if (sy < limit * 0.2 || sy > limit * 0.8) recentre();

    requestAnimationFrame(frame);
  }

  /* ----- music ---------------------------------------------------------- */

  // `wanted` is the visitor's choice for this visit: on every time the page
  // opens, whatever was chosen last time. Whether it is actually audible also
  // depends on the browser letting it
  // play, which needs a click, tap or key press first. The icon always shows
  // what you can actually hear.
  var bgm = document.getElementById('bgm');
  var soundBtn = document.getElementById('sound');
  var soundIcon = document.getElementById('soundIcon');
  var wanted = true;
  bgm.volume = 0.5;

  function showSound() {
    var on = !bgm.paused;
    soundIcon.src = on ? './img/volume.png' : './img/volume_muted.png';
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? 'Mute music' : 'Unmute music');
  }

  function tryPlay() {
    if (!wanted || !bgm.paused) return;
    var p = bgm.play();
    if (p && p.catch) p.catch(function () {});   // blocked until a gesture
    return p;
  }

  function setWanted(v) {
    wanted = v;
    if (v) tryPlay(); else bgm.pause();
  }

  soundBtn.addEventListener('click', function () {
    setWanted(bgm.paused);
  });
  bgm.addEventListener('play', showSound);
  bgm.addEventListener('pause', showSound);

  // Any first gesture anywhere starts the music if it's wanted - except on
  // the button itself: its pointerdown/keydown fires before its click, so
  // starting playback there would make the click read as "mute" straight away.
  ['pointerdown', 'keydown', 'touchend'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (!soundBtn.contains(e.target)) tryPlay();
    }, { passive: true });
  });

  /* ----- image loading -------------------------------------------------- */

  // The intro painting is preloaded at high priority from <head>. Once it is
  // in, the rest are fetched strictly one after another in story order (the
  // order of the data-src elements in the page), so the next scene's image is
  // never competing with ones further along, wherever the visitor is. Each is
  // only applied once fully loaded, so a scene never paints in half-way.
  var pending = [].slice.call(document.querySelectorAll('[data-src]'));

  function loadNext() {
    var el = pending.shift();
    if (!el) return;
    var src = el.dataset.src;
    var img = new Image();
    img.onload = function () {
      el.style.backgroundImage = 'url("' + src + '")';
      loadNext();
    };
    img.onerror = loadNext;
    img.src = src;
  }

  function loadImages() {
    var first = new Image();
    first.onload = first.onerror = loadNext;
    first.src = './img/intro.png';
  }

  /* ----- go -------------------------------------------------------------- */

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', onScroll, { passive: true });
  replayBtn.addEventListener('click', replay);
  startBtn.addEventListener('click', start);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') start();
  });

  /* The hint waits for the pixel font. On a first visit the font arrives
     from Google Fonts after the page is up; drawn before that, the hint's
     animated, filtered text could be left mispositioned (off to the right)
     when the font swapped in, until a refresh with the font cached. So it
     only appears once fonts are settled, with its bob animation restarted
     so it's laid out fresh in the final font. If the font never loads, it
     still appears after FONT_WAIT_MS in the fallback. */
  var fontReady = false;
  var FONT_WAIT_MS = 3000;
  function onFontReady() {
    if (fontReady) return;
    fontReady = true;
    hint.style.animation = 'none';
    void hint.offsetWidth;         // apply the 'none' before restoring it
    hint.style.animation = '';
  }
  if (document.fonts && document.fonts.load) {
    // (an empty result means the font's rules weren't in yet: wait for all fonts)
    document.fonts.load('12px "Press Start 2P"').then(function (f) {
      if (f.length) onFontReady(); else document.fonts.ready.then(onFontReady);
    }, onFontReady);
    setTimeout(onFontReady, FONT_WAIT_MS);
  } else {
    onFontReady();
  }

  resize();
  loadImages();
  showScene(0);
  showSound();
  // Some browsers allow sound straight away (e.g. on a site visited often).
  // Then there's nothing to wait for, so skip the start card.
  var auto = tryPlay();
  if (auto && auto.then) auto.then(start, function () {});
  recentre();
  requestAnimationFrame(frame);
})();
