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
  /* img/kirby_anim.png is a 26x22 cell grid lifted from the sheet:
       row 0 - idle, 2 frames  (line 1: stand + blink)
       row 1 - walk, 10 frames (line 5)
       row 2 - run,  8 frames  (line 6, frames 0-7; 8-10 are the skid-stop)
       row 3 - jump, 10 frames (line 4: 0 takeoff, 1-5 somersault, 6 coming
                                out of it, 7-8 falling, 9 landing squash)
       row 4 - puff, 8 frames  (line 8: inhaled and floating; the double jump)
     Cells are 26px tall so the puffed-up frames fit; everything is
     bottom-aligned, so the feet sit on the cell's bottom row in every frame. */

  var CELL_W = 26, CELL_H = 26;
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

  var GROUND_Y = 124;              // the placeholder scenes' ground line
  var LEFT_EDGE = 14;
  var RIGHT_EDGE = VW - 14;

  function flat() {
    return {
      segs: [[[LEFT_EDGE, GROUND_Y], [RIGHT_EDGE, GROUND_Y]]],
      jumps: [],
      enterFwd: LEFT_EDGE + 30,
      enterBack: RIGHT_EDGE - 30,
      ground: true                 // show the placeholder ground strip
    };
  }

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
    enterBack: 212,
    ground: false
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
    enterBack: RIGHT_EDGE - 30,
    ground: false
  };

  /* img/intro.png: walking IN the grass. Its front row of blades (tips ~123,
     cut out as img/intro_grass.png and drawn over the character) hides the
     feet, so 125 puts them just down among the blade tips.
     img/korea_elementary.png: the dirt strip between the two grass bands in
     front of the school gate. Both are straight walks, no jumps. */
  function straight(y) {
    return {
      segs: [[[LEFT_EDGE, y], [RIGHT_EDGE, y]]],
      jumps: [],
      enterFwd: LEFT_EDGE + 30,
      enterBack: RIGHT_EDGE - 30,
      ground: false
    };
  }
  var INTRO = straight(125);

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
    enterBack: RIGHT_EDGE - 14,
    ground: false
  };

  /* img/cambodia.png: along the front, where the plaza floor meets the stone
     wall's cap, and over the lotus pond in the middle (its stone frame spans
     x 74.5-165.5) with a DOUBLE jump: a hop from right at the pond's edge, then
     Kirby puffs up mid-fall and floats the rest of the way across. */
  var CAMBODIA = {
    segs: [
      [[LEFT_EDGE, 137.5], [72, 137.5]],
      [[170, 137.5], [RIGHT_EDGE, 137.5]]
    ],
    jumps: [
      { land: 178, landBack: 64, rise: 14,
        double: { span: 60, cut: 0.6, rise2: 12, floaty: 0.5 } }
    ],
    enterFwd: LEFT_EDGE + 30,
    enterBack: RIGHT_EDGE - 30,
    ground: false
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
    enterBack: RIGHT_EDGE - 14,
    ground: false
  };

  var COURSES = [INTRO, CHINA, TAIWAN, KOREA, CAMBODIA, KOREA_BACK, flat(), flat(), flat()];
  var SCENES = COURSES.length;

  var PAN = 24;                    // placeholder parallax across one scene

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
  var ground = document.getElementById('ground');
  var flash = document.getElementById('flash');
  var ending = document.getElementById('ending');
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
  var scrolled = false;

  // A transition swallows the rest of the scroll gesture that triggered it:
  // trackpad momentum and a still-spinning wheel keep producing deltas for a
  // second or more, and without this they'd shove the character across the new
  // scene the moment control came back. Input counts again only once the
  // scroll has been quiet for QUIET_MS.
  var QUIET_MS = 200;
  var lastInputAt = 0;
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
    scrolled = true;
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

  var phase = 'travel';            // 'travel' | 'jump' | 'transition' | 'ended'

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
    if (phase === 'jump' && jStage === 2) {
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
    ground.style.opacity = COURSES[i].ground ? 1 : 0;
  }

  function updateCaptions(frac, visible) {
    // Symmetric band: fades in off either edge and out towards either edge, so
    // it reads the same whether the scene was entered forwards or backwards.
    var a = visible ? smooth(frac / 0.14) * (1 - smooth((frac - 0.86) / 0.14)) : 0;
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

  function replay() {
    if (phase !== 'ended') return;
    // Already off the right edge, so there is nothing to walk off: flash, put
    // the first scene back up and walk in from the left as usual.
    beginTransition(1, 0, { skipExit: true, hideEnding: true });
    scrolled = false;              // bring the "scroll to walk / run" hint back
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
      if (now - lastInputAt > QUIET_MS) swallowing = false;
      else impulse = 0;            // still the gesture that started the transition
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
      if (phase === 'travel') y = heightAt(pts, x);   // follow stairs and slopes

    } else {
      impulse = 0;                 // scroll can't steer a jump, a transition or the end
      if (phase === 'jump') stepJump(dt, now);
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
    root.style.setProperty('--pan', (-frac * PAN).toFixed(2) + 'px');
    updateCaptions(frac, phase === 'travel' || phase === 'jump');
    fill.style.width = (((scene + frac) / SCENES) * 100).toFixed(2) + '%';
    hint.style.opacity = scrolled ? 0 : 1;

    // Keep room to scroll in both directions, without ever blocking the page.
    // Runs in every phase: scroll events still arrive during a transition, and
    // if the position were left parked against an end the next push would be
    // swallowed by the browser instead of reaching us.
    var sy = window.scrollY, limit = scrollLimit();
    if (sy < limit * 0.2 || sy > limit * 0.8) recentre();

    requestAnimationFrame(frame);
  }

  /* ----- music ---------------------------------------------------------- */

  // `wanted` is the visitor's choice (on by default, remembered across visits);
  // whether it is actually audible also depends on the browser letting it
  // play, which needs a click, tap or key press first. The icon always shows
  // what you can actually hear.
  var bgm = document.getElementById('bgm');
  var soundBtn = document.getElementById('sound');
  var soundIcon = document.getElementById('soundIcon');
  var MUSIC_KEY = 'kirby-music';
  var wanted = true;
  try { wanted = localStorage.getItem(MUSIC_KEY) !== 'off'; } catch (e) {}
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
  }

  function setWanted(v) {
    wanted = v;
    try { localStorage.setItem(MUSIC_KEY, v ? 'on' : 'off'); } catch (e) {}
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

  /* ----- go -------------------------------------------------------------- */

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', onScroll, { passive: true });
  replayBtn.addEventListener('click', replay);

  resize();
  showScene(0);
  showSound();
  tryPlay();                       // works straight away if the browser allows
  recentre();
  requestAnimationFrame(frame);
})();
