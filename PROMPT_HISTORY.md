# Prompt History — Qix-like Game

All prompts below were made on **March 22, 2026**, in a single extended session.
Earlier sessions (Mar 19–21) predating context compaction are not recoverable at the prompt level — only their git commits survive.
Approximate times are inferred from git commit timestamps.

---

## ~03:36 — FTUE, HUD & Core Gameplay

*(commit: "added FTUE")*

**1.** HUD: let's show the % needed to complete the level: like in format currentPercent/GoalPercent. It should be centered in the HUD. The Level indication should be a little above the percent and should stay there.

**2.** okay, cool. Now let's build a FTUE experience. First, let's teach our player to move & capture territory. This is why on the first we won't provide him with any enemies. In the screen center we will write something like "Swipe to move". Once the player moves, we'll change the text to...

**3.** lvl 1, phrase cool appears and disappears very quickly. Should be longer. Also, let's add some joystick animation to the center to encourage the player to move the joystick. Lvl 2, don't spawn sparks until player moves.

**4.** Cool! On lvl 1 after first territory capture let's write something like: Nice! Now capture as much as you can!

**5.** let's not return to the start of the progression after level loss. if player loses on lvl 3, he should start from lvl 3. Add a local save file system. In the settings menu add an option to wipe out the progress.

**6.** let's remove "ouch!" completely after taking damage

**7.** lvl 2 & 3, let's hold the info until the player moves

**8.** lvl 1: rephrase second phrase to "Connect line to capture the territory", add third phrase "Continue until you capture all"

**9.** rephrase 2nd lvl hint to "Qix can kill you when you draw"

**10.** lvl 3, remove QIX, rephrase to "Sparks kill you when they touch you"

**11.** okay, let's change lvl 2 with lvl 3. And on lvl 3 let's add sparks to QIX as well. The progression should be changed as well. Lvl 4 should be as lvl 1 before FTUE, lvl 5 as lvl 2 and so on

**12.** well, basically normal gameplay begins on lvl 3, so let's remove lvl 4. On lvl 5 we can increase the goal percent and duplicate the percent to lvl 6

---

## ~04:05 — Bug Fixes & HUD Rework

*(commits: "removed lives", "small HUD changes")*

**13.** bug: when we get killed, the screenshake is always repeated

**14.** heart mechanic doesn't make any sense now. thus let's remove it. 1 hit = instant kill

**15.** in HUD: LVL and % are in one pill. let's differentiate them. Let's put LVL indicator in the place where hearts were. The % should be centered

---

## ~04:40 — Territory Capture Bugs

*(commits: "territory fixes", "Fix territory fill")*

**16.** BUG: there are edge-cases when we connect a line to a corner of the territory which resolves in unconnected territory. We should eliminate them to make the gameplay feel snappier

**17.** now casual territory capture doesn't work

**18.** for some reason, on lvl 3 when I connect a first territory the game just stops

**19.** the game still showstops at lvl 3 after first territory capture

**20.** now any capture on lvl 3 results in lvl win

**21.** The algorithm is now broken. The line connect doesn't produce a captured territory

**22.** yes, this works correctly. push recent changes to main

---

## ~16:07 — Level End Transition & Sand Fill

*(commit: "Smooth level-end transition: animated sand fill + no glow")*

**23.** I don't like how the current transition to the end of the level is handled after we have won the level. What I would like to achieve: 1. enemies are removed if there are any. 2. We see an animation of the territory being captured...

**24.** The current level end feels like a glitch because of a pause. I would like the pause and transition feel more smoothly. 1. there should be a territory filling animation. This animation should work for all uncaptured territory...

**25.** remove the glow effect that is triggered upon level completion

**26.** push recent changes to main

---

## ~16:29 — Animated Digit Counter

*(commit: "animated sliding digit counter for goal display in HUD")*

**27.** let's change the percent tab. Let's name it Goal: DesiredPercent%. The DesiredPercent should be a single int number which will decrease depending on how much territory we need to capture

**28.** The number just changes. I would like to get some number animation to make it more satisfying. Let's go with sliding number counter animation

**29.** I don't want to see the previous digit once a new one is introduced. I would like the animation to be more smooth. The goal word should be the same in terms of size as the number itself. Also, the % sign should be placed next to the number

**30.** push the current changes to main

---

## ~18:27 — Cat Pixel Art for Level 2

*(commit: "added cat to 2nd lvl")*

**31.** for lvl 2 final image let's use the cat image

**32.** create a sand cat image from the reference I've provided you with *(cat reference image attached)*

---

## ~18:30–21:40 — Interactive Tutorial Attempt (fully discarded)

*(no commit — all changes were reverted)*

**33.** I would like the tutorial to be a little more interactive. Let's place on lvl 2 another bucket on the halfway to the player. By scenario the spark will go to a bucket and kill it. Once killed the spark will be repositioned...

**34.** I would like the bucket kill scenario to be repeated. 1. We start lvl 2, the sparks move the bucket. 3. the sparks kill the bucket. 4. the scene is repeated (bucket is respawned, sparks are repositioned). 5. once the player moves — the decoy disappears

**35.** I would like the sparks to be unfrozen before the first input

**36.** The logic is a little bit wrong. I would like the decoy bucket kill to be a pre-input scene. So that when the player got to lvl 2 he saw that sparks can kill the bucket. And the scene should be repeated...

**37.** the repeat doesn't happen right after the sparks kill the decoy

**38.** set it to 0.25

**39.** don't respawn sparks upon first input on lvl 2 and reset decoy.respawnTimer to 0.8

**40.** and leave the decoy there after first input

**41.** After first input if decoy is killed, the decoy should not respawn

**42.** on lvl 3 we should play a similar scene. 1. A decoy will draw a line 2. A QIX will bump into a line and kill a decoy 3. repeat

**43.** the decoy doesn't do anything on lvl 3

**44.** on lvl 3 don't spawn sparks until first input

**45.** question: so the only unpushed changes are only the ones that are changing the tutorial flow, right?

**46.** okay, cool let's discard these changes. I want to rework the tutorial *(entire interactive tutorial direction scrapped)*

---

## ~21:42 — UI Polish, Level Restructure & Fuse Removal

*(commit: "UI/gameplay overhaul: fuse removal, death reason, level restructure")*

**47.** okay, 1st. Let's change "Goal:" to Claim

**48.** Upon lvl win let's change Claim n%, to "WIN!"

**49.** on win lvl pop-up let's remove "get ready..." text and change "Next level" to "Play"

**50.** 1. lvl 1, let's change 2nd text to "Connect the line". and 3rd to "Claim the rest". 2. lvl 2. change text to "avoid enemies"

**51.** Okay, now let's remove lvl 3 and add QIX to lvl 2.

**52.** On lvl 2 let's make enemies slower than on lvl 3

**53.** on game over screen let's remove lvl #. let's write something like "captured 10%". Killed by {reason name}. Possible reason names: "QIX" "Sparks" "Fuse"

**54.** let's change 1st lvl requirement to 50%, 2nd to 60%, 3rd will be 65%

**55.** Let's remove fuse completely from the game

**56.** push all of the changes to main

---

## ~21:57 — Persistence, Feedback & Menu Cleanup

*(commit: "Persistent save, capture feedback, pause menu cleanup")*

**57.** Implement a Persistent Save System using localStorage

**58.** When capturing territory, let's provide an additional text feedback like we used to '-15%'

**59.** let's change -n% text color to the one used by "claim"

**60.** remove outline from -n% floating text

**61.** hide sparks & boss toggles from the pause menu

**62.** remove text "sandbox settings" from the pause menu

**63.** why error: exit code occurs? and what it influences?

**64.** okay, push recent changes to main

**65.** now fix exit code 2 error

---

## ~22:08 — Enemy Counts & Crab Visuals

*(commits: "Fix TS errors, adjust enemy counts", "Replace spark visuals with animated crab")*

**66.** let's amount of sparks on lvl 2 will be = 1. On lvl 3 let them be 2

**67.** push to main

**68.** let's change sparks visuals to crab visuals

**69.** in ghost mode turn off walking

**70.** cool, push to main

---

## ~22:23 — QIX Kill Mechanic

*(commit: "Kill QIX by enclosing it; rename Sparks to Crabs")*

**71.** Let's add a possibility to kill QIX. The same as with crabs. We kill it, it takes some time to respawn.

**72.** no, only capturing QIX within our new territory (as with crabs) should kill QIX *(direction correction)*

**73.** in game over screen change "sparks" to "crabs"

**74.** push to main

---

## ~22:45 — Pixel Art, Level Animations & FTUE Polish

*(commits: "Level animations, pixel heart, QIX kill, crab visuals polish", "Level 4 Mona Lisa art, level 3 hint, digit animation fixes")*

**75.** in lvl 3 let's redraw the picture to a heart picture *(heart reference image attached)*

**76.** oh. on lvl 3 in the tutorial fashion from lvls 1&2 let's write 'Have fun!'

**77.** When showing a Level screen use the same animation as for the percent. Thus, upon reaching a new level change number from lastLevelNumber to NewLevelNumber

**78.** pop-up instantly spawns with level 2. maybe the sliding should happen right after the pop-up occurs?

**79.** still doesn't work as intended

**80.** ah I've got it. you've changed the behaviour of lvl tooltip in the HUD (upper left corner). However, what I've been asking for is that on the pop-up where we see 'Level #' & 'Play' button, the # should be changed using the sliding animation

**81.** no need to revert it. I like it. Just add the sliding animation to the mentioned pop-up

**82.** damn that felt good. I would only ask you to reverse the direction. Currently digit animation goes from bottom to top. I would like it to change from top to bottom

**83.** Cool, push it to main

**84.** okay, now let's change the reveal image on lvl 4 *(Mona Lisa pixel art reference attached)*

**85.** in lvl 3, after we show hint 1 time, don't repeat it. For example if we get killed, the hint shouldn't be repeated

**86.** push to main

---

## ~23:14 — Difficulty Tuning, Debug Tools & Rubber Duck

*(commit: "Add debug win, duck art, crab visuals, QIX kill, and difficulty tuning")*

**87.** okay, let's change the difficulty a little bit. On level 4 let's provide 4 crabs, change shell colour to blue. And remove 1 QIX. And on level 5 let's spawn 2 QIXes and 2 crabs

**88.** slight addition, there should be 2 red crabs and 2 blue crabs on lvl 4 *(mid-request correction)*

**89.** add a debug option in pause menu to win lvl. it should instantly capture the whole territory and let me view the picture

**90.** on lvl 4 spawn 1 QIX as well as 4 crabs

**91.** let's change picture on lvl 5 *(rubber duck pixel art reference attached)*

**92.** push to main

---

## Stats

| Metric | Value |
|---|---|
| Date | March 22, 2026 (single session) |
| Total prompts | ~92 |
| Pushes to main | 10 |
| Direction changes / full reverts | 2 (entire interactive tutorial scrapped ~14 prompts; QIX kill mechanic corrected mid-implementation) |
| Bug fix prompts | ~7 |
| Art / content prompts | ~6 (images attached for cat, heart, Mona Lisa, rubber duck) |
| Clarification follow-ups (same feature, 2+ prompts) | ~15 |
| Longest dead-end branch | Interactive tutorial (~14 prompts, 0 commits) |

---

---

# Commit History — Chronological

What was actually built, commit by commit.

---

## March 19, 2026

**18:27 — Initial commit**
Full project scaffolded from scratch: React + Vite + TypeScript, canvas renderer, game loop, grid system, player movement, QIX entity, spark enemies, territory capture logic, HUD, overlays, joystick component, audio stub. ~6100 lines added across 21 files.

**20:57 — Add sparks, legacy seams, toggles, and loop trim**
Spark enemies added with patrol AI. Toggle controls for sparks/boss in UI. Loop rendering trimmed. History log started.

**21:08 — Add spark migration targets and Bresenham fill**
Sparks can now migrate through captured territory toward the active border using a ghost mode. Bresenham line fill for territory capture.

**21:54 — Changes to UI & particles, crashed filling**
UI and particle system reworked. Fixes to territory fill crash edge cases.

**22:29 — Visual fixes, new UI**
Visual overhaul: new HUD layout, renderer improvements, App game loop cleanup.

**22:56 — Tilting**
Bucket/HUD tilt effect added — canvas tilts dynamically based on player movement direction.

**23:14 — Small changes**
Minor App.tsx tweaks.

---

## March 20, 2026

**00:08 — Refactoring**
Major architectural split: monolithic App.tsx broken into dedicated modules — `GameState.ts`, `grid.ts`, `player.ts`, `qix.ts`, `sparks.ts`, `territory.ts`, `particles.ts`. ~1000 lines moved out of App.tsx.

**00:16 — UI improvements**
HUD component polished.

**01:56 — Huge game refactor**
Full rewrite of all game modules. QIX movement, collision, and spark AI overhauled across all files simultaneously.

**02:39 — Major design redo**
HUD redesigned significantly. Renderer updated. Product requirements document added.

**03:02 — Star update**
Minor HUD cleanup.

**03:12 — Highlight and timeout invalid drawing loops**
Invalid line loops (player drawing back to start without capturing) now highlighted and timed out visually.

**16:42 — Enhance QIX movement, collision, and rendering**
QIX trail rendering improved. Collision detection with player trail refined. QIX movement tuned.

**16:49 — Field changes**
Constants and renderer field sizing adjusted.

**21:35 — Border logic redo**
Complete rewrite of border/edge cell detection logic in grid.ts. Renderer updated to match. Bug fixes for player border snapping.

---

## March 21, 2026

**01:34 — Sand drawing**
Major feature drop: sand-art aesthetic for territory rendering. Pixel art system introduced (`pixelArt.ts`) with level reveal animations. Level end sequence added with DISSOLVE and INTERSTITIAL stages. DissolveParticle type, fill wave animation, level art per level. Overlays redesigned. ~850 lines added.

**02:22 — Added Burny logo**
Level 1 pixel art changed to Burny Games logo. Logo assets added to public/. HUD simplified.

**02:36 — Fixed sparks, removed reveal button**
Spark migration and patrol bugs fixed. Manual "reveal" debug button removed from UI. Territory capture edge cases cleaned up.

---

## March 22, 2026

**03:36 — Added FTUE**
Full first-time user experience: level 1 has no enemies, shows "Swipe to move" → "Connect the line" → "Claim the rest" hints with joystick animation. Level 2 introduces QIX with "avoid enemies" hint. Level 3 adds sparks. Hints gated behind player input. Game loop restructured to support staged tutorial.

**04:05 — Removed lives**
Heart/lives system removed entirely. Game is now 1-hit instant kill. All related UI and state cleaned up (~100 lines removed).

**04:08 — Small HUD changes**
LVL and % indicators separated into distinct pills.

**04:40 — Territory fixes**
Territory capture algorithm rewritten to fix edge-case bugs where corner connections produced unconnected regions or incorrectly awarded level wins.

**15:20 — Fix territory fill: use QIX position to identify open field**
Territory fill now uses QIX entity position to reliably identify which flood-fill component is the "open field" vs captured area, fixing incorrect level-win triggers on QIX levels.

**16:07 — Smooth level-end transition: animated sand fill + no glow**
Level completion now triggers an animated wave fill of remaining territory instead of an instant snap. Glow effect on completion removed. LEVEL_CLEAR → DISSOLVE → INTERSTITIAL pipeline made smooth.

**16:29 — Animated sliding digit counter for HUD**
Goal percentage display replaced with animated sliding digit strip. Digits slide top-to-bottom when the value changes. `AnimatedCounter` and `AnimatedDigit` components added to HUD.

**18:27 — Added cat to 2nd lvl**
Level 2 pixel art changed to a sand-style cat illustration. `pixelArt.ts` updated with cat bitmap.

**21:42 — UI/gameplay overhaul: fuse removal, death reason, level restructure**
Fuse mechanic removed completely. "Goal:" label renamed to "Claim". Game over screen now shows captured % and kill reason (QIX / Sparks). Level structure reorganized. "Next level" → "Play". Unnecessary UI elements pruned across all components.

**21:57 — Persistent save, capture feedback, pause menu cleanup**
localStorage save system: game resumes from last reached level on app load. Floating "-N%" text feedback on territory capture. Sparks/boss toggles and "Sandbox settings" removed from pause menu.

**22:08 — Fix TS errors, adjust enemy counts, clean up pause menu**
TypeScript exit-code-2 error fixed (React 19 key prop issue in HUD). Level 2 set to 1 crab, level 3 to 2 crabs.

**22:13 — Replace spark visuals with animated crab, freeze in ghost mode**
Spark enemies re-skinned as animated canvas-drawn crabs (body, shell, claws, legs, eyes). Ghost/migrating crabs freeze all animations and render translucent.

**22:23 — Kill QIX by enclosing it; rename Sparks to Crabs**
QIX can now be killed by enclosing it within newly captured territory (same mechanic as crabs). Killed QIX respawns after 5 seconds with burst particles. Death reason "Sparks" renamed to "Crabs" throughout.

**22:45 — Level animations, pixel heart, QIX kill, crab visuals polish**
Level 3 pixel art changed to hand-crafted pixel heart bitmap. "Have fun!" FTUE hint added to level 3 (shown once only). Animated level number added to interstitial popup (slides top-to-bottom using AnimatedCounter). HUD level pill also gains digit animation. Crab rendering polished.

**22:58 — Level 4 Mona Lisa art, level 3 hint, digit animation fixes**
Level 4 pixel art changed to a 20×20 Mona Lisa. Level 3 hint fixed to not repeat on death. Digit animation direction corrected to top-to-bottom. AnimatedDigit initial position bug fixed.

**23:14 — Add debug win, duck art, crab visuals, QIX kill, and difficulty tuning**
Level 5 pixel art changed to rubber duck (yellow body, orange beak, dark golden wing). Debug "Win Level" button added to pause menu — instantly fills all territory and triggers level reveal. Level 4 now has 1 QIX + 4 crabs (2 red + 2 blue). Blue crab color variant added throughout pipeline. Level 5 has 2 QIX + 2 crabs.

