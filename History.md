# Prompt History

1. Implement the following plan: Fix: Web appearing on whole border after first territory capture
2. I would like the joystick to be smaller
3. Bug: once the spider is dead, he respawns on the top left border. Resulting in being stuck within the newly created borders. Expected result: the spider spawns on the nearest border from his death point
4. BUG: between the captured territory and original border is a space where the player can go
5. BUG: the player is still able to go in the place between the web and the wooden frame
6. BUG: when going inside of the corner, the player starts stuttering
7. Bug: when moving into the corner the spider begins stuttering and it is required to move in some other direction to exit the corner. Expected result: the movement is smoothed out to improve player experience in such cases, so that the player is never stuck
8. Bug: it is still possible to get stuck between the web and the border which results in softlock, meaning it is impossible to continue the game
9. Like in original QIX game I would like to see how I created my borders
10. Implement a non-lethal self-intersection check for the trail. If the player crosses their own path, identify the resulting closed loop, highlight it in red as 'invalid,' and allow the player to continue drawing from the intersection point without losing a life.
11. In the original Qix, the "territory border logic" is defined by Graph Traversal and Boundary-Bound Enemies. [full Spark/graph description] — let's replicate the original border logic from QIX
12. Bug: sparks spawn at the player's position which result in instant fail. Let's spawn them in the opposite corner from the player
13. Bug: when capturing a spark, we lose a life
14. Sparks stop when we start creating a new border
15. In the settings menu create toggles: 1. remove sparks 2. remove boss. They will turn off these objects for the match. After replay, they will get back
16. Bug: the toggles in the settings don't remove the visualisation of enemies
17. Implement Legacy Edge Persistence. Instead of deleting the boundary lines that fall inside a newly captured area, move them to a non-collidable background layer. I want the 'seams' of previous captures to remain visible as a visual history of the player's progress.
18. Let's keep the toggles in the settings when we restart the page. Bug: after eating a spark with a territory, they start staying in one place
19. Legacy Edge Persistence doesn't work
20. Let's make legacy lines a little bit bigger
21. Let's create a History.md file where you will place history of my prompts to you
22. Border Interaction / Pathfinding Logic [full QIX Spark spec] — let's replicate the original border logic from QIX
23. Implement Delayed Edge Migration for the Sparks. When a territory is captured, do not snap the Sparks to the new border. Instead, allow them to finish traversing their current segment. Only once they reach a vertex (intersection) should they transition to the nearest Active boundary edge
24. 1. spawn sparks at the bottom of the screen 2. bug: when sparks reach the corner of the field, they stop there 3. sometimes, when I draw a new line to capture a territory, the sparks stop
25. Add a toggle for fuse in the settings (like sparks and boss)
26. Bug: sometimes the spider gets damaged for no reason at all
27. Bug #2: the sparks pathfinding isn't smooth. sometimes they stay in the corner or instantly respawn on the new border when captured
28. Bug: sometimes the spider gets damaged for no reason at all (died without touching a spark)
29. Bug #1: web doesn't fully cover captured territory. Bug #2: sparks don't move to new borders after capture
30. Task: Refactor the Qix game engine to a Hybrid Casual Sand Aesthetic — bucket sprite replacing spider, sandy grain trail, sand CanvasPattern with wave-reveal for captured territory, warm amber palette for borders/seams/HUD, black void background, sand grain death explosion
31. Implement QIX Classic Gameplay Rewrite: 5-type cell grid (EDGE/LINE/NEWLINE/FILLED/EMPTY), dual-seed BFS fill, Verlet QIX wandering, spark grid-junction patrol, Ghost Edge Traversal
32. Bug: cannot leave border with joystick + tiny trail fills entire territory — fixed degenerate trail overlap detection and same-cell NEWLINE position advancement in player.ts
33. read product requirements.md analyze the screenshot and redesign the app according to the new guidelines — implemented desert-dusk PRD redesign: starry night sky with sand dune silhouette, golden gritty sand texture for FILLED cells, warm amber frame border, white-hot NEWLINE trail glow, amber LINE cells, glassmorphism HUD top bar
