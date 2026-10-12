# Implementation Plan: Scroll-Controlled Personal Journey Website

## 1. Project Overview

Build a single-page, side-scrolling-style personal story. The visitor scrolls vertically, while the main scene stays pinned in the viewport. A character walks from left to right as the background changes through AI-generated environments representing milestones in the author's life.

The experience should feel like a small interactive game rather than a conventional portfolio.

### Core experience
- Vertical scrolling controls the journey.
- A character walking animation responds to scroll progress.
- Background environments transition smoothly between life milestones.
- Short story captions appear at relevant points.
- The final scene reveals a futuristic research laboratory and a robot.

### Initial character choice
The current concept uses Kirby. Use only assets the project owner has permission to use. If suitable licensed/authorized assets are unavailable, substitute an original round, pink companion character. Keep the character implementation asset-agnostic so the sprite can be replaced without changing the scroll system.

## 2. Recommended Implementation Approach

Use a pinned viewport with a tall scrollable section. Keep the scene `position: sticky` while the user scrolls through the journey. Map scroll progress to:
1. Character horizontal position.
2. Character walking animation frame or playback.
3. Background crossfade progress.
4. Story caption visibility.
5. Optional decorative animation progress.

Use CSS and JavaScript for the first version. A scroll-animation library such as GSAP + ScrollTrigger is optional, not required.

**Build a working two-scene prototype before generating every asset.**

## 3. Narrative and Scene Plan

Use five main scenes. Keep text concise and let the visuals tell most of the story.

| Scene | Story milestone | Visual direction | Suggested caption |
|---|---|---|---|
| 1. Childhood | Early years abroad | Dreamy grassy landscape, flowers, clouds, winding path | “Every journey begins somewhere. Mine started with a childhood spent exploring different places.” |
| 2. Different worlds | Living across China, Taiwan, Cambodia, and Korea | Stylized cityscape and/or tropical environment | “Growing up across different countries gave me new environments and perspectives.” |
| 3. Game worlds | Computer science, games, and character animation | Pastel digital world, floating platforms, geometric elements | “I became fascinated by the worlds inside games—and by how their characters move.” |
| 4. Coffee break | Hand-drip coffee and personal interests | Cozy illustrated café, coffee dripper, warm light | “Between studying and imagining new worlds, there’s always time for a good cup of hand-dripped coffee.” |
| 5. The future | Master’s studies in Culture Technology; research, game technology, and robotics | Futuristic research lab, monitors with abstract motion diagrams, small robot | “I want to explore how digital characters can move naturally—and perhaps one day build robots of my own.” |

Ending message:
> “The journey continues…”

The exact scene order and wording can be revised during implementation. Avoid implying that the visual scenes are literal depictions of specific childhood memories; they are stylized representations.

## 4. Asset Requirements

### Minimum viable prototype
Start with:
- One character walking sprite sheet or looping animation.
- One childhood background.
- One futuristic laboratory background.
- One intermediate transition background.
- Two short story captions.

### Full version
- Character:
  - Walking sprite sheet with approximately 4–8 consistent frames, or a looping animation.
  - Optional idle pose for when scrolling stops.
  - Transparent background preferred.
- Backgrounds:
  - `childhood.webp`
  - `city.webp` (optional)
  - `gameworld.webp`
  - `coffee.webp`
  - `futurelab.webp`
- Transition backgrounds (optional but recommended for key transitions):
  - `childhood-to-city.webp`
  - `city-to-gameworld.webp`
  - `coffee-to-future.webp`
- Optional transparent objects:
  - `robot.png`
  - `coffee-cup.png`
  - decorative particles/sparkles
- Optional audio:
  - footsteps, coffee pouring, ambience; muted by default and only played after user interaction.

### Background image guidance
Generate backgrounds with a consistent art direction:
- Wide, horizontal compositions (start at 1920×1080 or a similar 16:9 ratio).
- Consistent side-view camera and horizon placement.
- A path or ground line that continues through the lower part of each image.
- Similar lighting and color palette.
- No character in the background; the walking character is a separate foreground asset.
- Keep key visual content away from the edges so cropping on different screens is less disruptive.
- Optimize final images as WebP where possible.

### Transition image guidance
Use image references/edits when supported by the image-generation tool. Preserve camera angle, horizon, path placement, lighting direction, and illustration style. Transform the environment gradually rather than changing every element at once.

Do not generate all assets upfront. First test two backgrounds and one transition image in the webpage.

## 5. Interaction and Animation Requirements

### Scroll-driven scene
- The main scene fills the viewport and remains pinned/sticky during the journey.
- The page has sufficient scroll height to map scrolling to the full experience.
- Scrolling down advances the journey; scrolling upward reverses it.
- The experience should work with mouse wheel, trackpad, keyboard scrolling, and touch scrolling.
- Avoid hijacking the browser's native scroll behavior.

### Character movement
- Keep the character in the foreground and above the backgrounds.
- Prefer keeping the character near a stable screen position while the environment changes/moves horizontally; optionally move the character from left to right for the opening and ending.
- When scroll progress is changing, animate the walking cycle.
- When scrolling stops, switch to an idle pose or pause on a natural frame.
- Map animation speed to scroll speed only if it remains stable and does not flicker.
- Ensure the sprite frame dimensions are known and consistently cropped.
- Use `image-rendering: pixelated` only if the selected art style is pixel art; otherwise use normal image rendering.

### Background transitions
- Stack background layers in the same viewport.
- Use scroll progress to set opacity directly (rather than relying only on a fixed-duration CSS transition). This makes transitions reversible when scrolling upward.
- Crossfade between adjacent scenes.
- Add intermediate images for major transitions where a simple crossfade looks like unrelated images dissolving together.
- Preload nearby/next background images to reduce flashes or blank frames.
- Avoid abrupt background-position changes between scenes.

### Story captions
- Show a short title and 1–2 lines of text per milestone.
- Fade captions in and out according to scene progress.
- Keep text readable against every background; use a subtle translucent panel or text shadow if needed.
- Position captions away from the character and important scenery.
- Do not bake text into AI-generated images; render text in HTML for accessibility and responsive layout.

### Optional effects
Add only after the core experience works:
- Slowly moving clouds or parallax layers.
- Coffee steam that turns into clouds or particles.
- Small robot reveal in the final scene.
- Subtle particles during transitions.
- Optional sound effects, muted by default.

## 6. Suggested Scroll Mapping

Treat the whole journey as normalized progress `p` from `0` to `1`.

Example scene ranges (adjust during testing):
- Scene 1: `0.00–0.20`
- Scene 2: `0.20–0.40`
- Scene 3: `0.40–0.60`
- Scene 4: `0.60–0.80`
- Scene 5: `0.80–1.00`

For each adjacent pair, define a transition interval near the boundary. During that interval, interpolate the outgoing background opacity from `1` to `0` and the incoming background opacity from `0` to `1`. Clamp all values to `[0, 1]`.

Use an easing function for a gentle visual feel, but ensure opacity is always derived from scroll progress so reverse scrolling behaves naturally.

The scene ranges are an initial plan, not fixed requirements. Allow enough scroll distance for the captions to be read.

## 7. Suggested File Structure

Adapt this structure to the existing project if one already exists.

```text
my-journey/
├── index.html
├── style.css
├── script.js
└── assets/
    ├── character/
    │   ├── walk-sheet.png
    │   └── idle.png
    ├── backgrounds/
    │   ├── childhood.webp
    │   ├── city.webp
    │   ├── gameworld.webp
    │   ├── coffee.webp
    │   └── futurelab.webp
    ├── transitions/
    │   ├── childhood-to-city.webp
    │   ├── city-to-gameworld.webp
    │   └── coffee-to-future.webp
    ├── objects/
    │   ├── robot.png
    │   └── coffee-cup.png
    └── audio/
        ├── footsteps.mp3
        ├── coffee.mp3
        └── ambience.mp3
```

Not every optional asset needs to exist. Missing optional assets should not break the page.

## 8. Implementation Phases

### Phase 1 — Two-scene proof of concept
1. Inspect the existing project and its framework/tooling before changing files.
2. Create a full-screen sticky scene with two layered backgrounds.
3. Add a tall scroll area and compute normalized scroll progress.
4. Crossfade from the childhood background to the future laboratory.
5. Add a basic caption that changes with progress.
6. Test scrolling down and back up.

**Acceptance criteria**
- Both backgrounds load without flicker.
- The transition is reversible.
- No horizontal page overflow.
- The pinned scene remains aligned in the viewport.

### Phase 2 — Character animation
1. Add the walking sprite sheet or looping animation.
2. Determine frame dimensions and frame order.
3. Animate frames while scrolling.
4. Pause or use an idle pose when scrolling stops.
5. Place the character above background layers and below captions where appropriate.

**Acceptance criteria**
- The sprite is cropped correctly.
- The character does not jump vertically between frames.
- Walking animation remains smooth at different scroll speeds.
- Character remains visible at desktop and mobile sizes.

### Phase 3 — Add all story milestones
1. Add the remaining backgrounds.
2. Map all five milestones to scroll progress.
3. Add the captions.
4. Tune transition intervals and background positioning.
5. Add a final “The journey continues…” ending.

**Acceptance criteria**
- Scene order and captions match the intended story.
- Text does not overlap the character or become unreadable.
- Reverse scrolling restores previous scenes cleanly.

### Phase 4 — Improve visual continuity
1. Identify transitions that look like unrelated images dissolving together.
2. Generate intermediate AI images for only those transitions.
3. Match horizon, ground/path, lighting, palette, and camera angle.
4. Preload the next background and optimize image sizes.

**Acceptance criteria**
- No visible blank frames during transitions.
- Key transitions feel intentional.
- Initial page load remains reasonable.

### Phase 5 — Polish and accessibility
1. Add subtle parallax or decorative effects if useful.
2. Add the robot reveal.
3. Make audio optional and muted by default if included.
4. Support `prefers-reduced-motion` with a simpler, less animated presentation.
5. Add meaningful alt text for informative images; mark purely decorative images appropriately.
6. Test on desktop and mobile, including touch scrolling.
7. Check contrast and caption readability.

**Acceptance criteria**
- Page remains usable on small screens.
- Reduced-motion mode avoids intense scroll-linked motion.
- No essential information is conveyed only through animation.
- No console errors or missing-asset errors.

## 9. Technical Notes

- Prefer CSS `position: sticky` plus JavaScript for the initial implementation. Use GSAP + ScrollTrigger only if it materially simplifies the project or is already installed.
- Keep background opacity and character movement driven by scroll progress, not independent timers.
- Use `requestAnimationFrame` or a scroll library's update loop to avoid excessive DOM updates.
- Preload the first background and character asset. Lazy-load later assets where practical, but preload the next scene before its transition begins.
- Avoid adding a heavy 3D engine; the intended first version is a 2D layered experience.
- Keep story text in HTML rather than inside generated images.
- If the selected sprite sheet has a different layout than expected, adapt the frame-cropping logic rather than assuming a particular sheet format.
- Keep assets replaceable so an original character can be substituted for Kirby later without rewriting the scene logic.

## 10. Definition of Done

The project is complete when:
- The page tells a coherent personal story through five scenes.
- Scrolling controls the journey and character animation.
- Background transitions are smooth and reversible.
- The page works on desktop and mobile.
- Assets load reliably and are reasonably optimized.
- The ending clearly communicates the author's interest in character animation, game technology, and future robotics research.
- AI-generated assets and AI-assisted development are used intentionally, and the project owner can describe those choices in the assignment submission.
