# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

# Dream Memory UI Direction

Use the moon-grid reference mock as the durable visual target for this prototype. UI work should match its single-screen mobile composition: compact top status bar, title and floor panel, large central merged-grid board, concise bottom skill/shop/route controls, ornate dark dream-archive styling, clear multi-cell merged cards, and dense but readable Chinese labels.

Design and implementation should prioritize one-screen play. Avoid explanatory text blocks that consume screen space. End-of-level settlement should replace the board area or overlay it while preserving a complete view of the board. Skill selection after a level should feel like choosing from three reward cards, not like a settings or function menu.

Hide settings entry points until there is an actual settings need. Do not keep placeholder settings buttons in the main play HUD.

Top status and action controls must stay in one compact fixed-height row. During active play, the top-right actions are only audio and 图鉴; do not add reset/settings there. Changing buttons must not create implicit grid rows, stretch the top panel, or push the board and bottom dock out of the mobile viewport.

The start screen should lead with game background and memory atmosphere rather than an empty board preview. Use a real mood image and concise story copy to evoke lost-name nostalgia before the player enters the dream.

The archive/图鉴 is a persistent collection across runs, not temporary run state. Restarting a run must keep archive records, and the start screen should provide a reusable archive entry point.

Do not use screenshot crops as UI chrome for the playable interface. Use controlled CSS and icon components to recreate the atmosphere so layout, scale, and readability remain adjustable.

During active levels, matched or acquired cards should disappear from the board so they no longer interfere with reading the remaining puzzle. Settlement screens may show completed cards again for the full-board recap.

When a match succeeds, recovered cards should linger long enough for the player to read the card content and value before fading out. Keep failed-match recovery faster than successful-match collection feedback.

When the player has started matching a multi-fragment memory, every newly flipped card participates in that match attempt. A single utility, hazard, or one-off item may resolve immediately only when no multi-fragment match is in progress; if flipped during another fragment match, it should trigger mismatch feedback and flip back with the selected fragments.

Visible board cards should prioritize readable fragment information over title scale. When a cell is tight, shrink the icon/title treatment and preserve the fragment progress, kind, value, and effect lines first.

Card text layout may use separate parameters per card footprint: single-cell, vertical, horizontal, large rectangular, and irregular shape cards can each choose icon visibility, title size, wrapping, and detail density. Complete Chinese card names should not be truncated just to preserve icons.

Every visible board card kind should use explicit text-fit parameters rather than falling back to one shared default. Tune fragment, utility, hazard, treasure, rectangular, and irregular-shape cards so the most useful information stays readable in that footprint.

Board card names should be authored against each footprint's safe character budget before they reach the UI. Single-cell, vertical, and irregular cards should generally use 2-3 Chinese characters; large cards may carry slightly longer names only when the title width remains inside the card. If a name exceeds its safe width, shrink the title modestly first, then constrain or alias the content name rather than allowing text to spill outside the card.

When shortening nostalgic memory names, prefer plain recognizable nouns over stylized coined words. For example, use `蓝屏` and `磁带` directly rather than decorative variants like `屏响`, `禧带`, or `旧带`; let the dream atmosphere come from card art, color, and context.

Memory names should directly trigger old-life associations before they sound poetic. Prefer concrete objects and scenes such as `桌洞`, `蓝屏`, `磁带`, `车票`, and `练习本`; avoid abstract functional labels like `暗格` when a more specific nostalgic word fits the same card footprint.

Irregular multi-cell cards should not place text at the bounding-box center when that crosses clipped-out space. Anchor their readable content to the largest visible run of occupied cells, and keep the shape palette varied with rotated/mirrored L/J forms plus Tetris-like T/S/Z silhouettes where the board can support them.

Irregular card focus, hover, and selected highlights must follow the clipped silhouette. Do not allow rectangular cell outlines or glow fragments to leak from the underlying grid; remove the glow if a shape-following highlight is not reliable.

Level progress should show the clear target as a visible marker on the bar, but avoid tiny marker text. Reaching the marker means the level is complete; progress beyond the marker should continue visually as overflow reward and may display percentages above 100%. Use distinct bar colors for unmet, met, and overflow states.

During active levels, the level timer should count down in real time. Turning cards is not a hidden time cost; only explicit events such as entry, shop purchases, mismatch penalties, and dream interference should change time.

Time feedback should stay compact and scannable, using `00:30` style values. The level info panel should show current level time plus the most useful live state, such as refill status on refill-enabled levels; route-choice panels only need the current layer, not a redundant next-layer row.

Avoid showing the same metric in multiple places at once. Keep top status for total/target/acquired value, board progress for scene plus percent, the side panel for live level state, and the notice strip for the latest event cause.

Elite, Boss, and other refill-enabled levels should express refill inside the board, not mainly in the side info panel: empty recovered slots show translucent card backs that materialize, and completed refill gets a brief board-level flash.

Failed matches should linger briefly and then flip back without blocking the player from continuing to flip other available cards. Successful matches should linger longer so the recovered card content can be read.

A run should support three clear styles: strong Build control, fast hand speed, and strong reasoning/memory.

The bottom dock should match the reference structure: left side shows run Build skills, and the right side keeps a visible merchant item card. Board utility cards should either resolve immediately or provide energy that charges Build skills; merchant items remain separate purchasable props.

During active play, the route strip must stay to a single horizontally scrollable row. It should not wrap to two rows or consume board height on mobile browsers. The current route position must be visually marked and quickly locatable after horizontal scrolling.

Shop items are finite per shop visit. Once a merchant item is purchased, remove that corresponding row from the current shop list instead of allowing repeat purchases; prices should be shown as time costs such as `00:30`, not bare numbers.

Route-choice screens should avoid empty panels. Present the available next nodes as large vertical cards with stronger atmosphere and clear hierarchy, rather than compact horizontal option tiles.

Route card subtitles should be memory-atmosphere names rather than functional descriptions. Each node type should own exactly one durable atmosphere package for Act 1: 普通=旧校门回廊, 精英=碎月操场, 商店=千禧梦市, 休息=月窗卧室, Boss=遗失姓名. The route art should match that atmosphere and avoid embedded text so UI copy remains editable.

# Dream Memory Act 1 Gameplay Direction

The story frame is entering a dream to find lost pieces of the self. Time is the countdown to waking: entering deeper memories spends dream time, recovering enough value extends the dream, and lingering or failing inside a memory can wake the player early.

Total dream time is the run's asset pool. Entering a level pays the entry cost from that pool once; inside the level, only the level timer counts down. Clearing a level returns remaining level time and adds overflow reward time, and that sum is the level's time gain. Do not display total dream time as the run asset pool plus the live level timer.

If the route reaches the Boss/terminal node and the player cannot pay its entry time, the run should fail immediately instead of leaving the player stuck on the route-choice screen.

Players should begin a run with empty skill and merchant item slots. Skills, board modifiers, and passives must be found through post-level Build rewards. Build cards should show clear tags: skill, board, passive, and rare dream-seed style rewards.

Build rewards should use three primary tags: 技能 for active dream-control tools such as 指引, 回溯, 定时锁定, and 碎片折光; 棋盘 for changing dream structure such as energy-card upgrades, energy efficiency, and reduced interference; 被动 for subconscious rules such as first-mistake protection, overflow-time improvement, and small-card value boosts. Boss or stage-end advanced passives should use the 梦种 tag, representing seeds left in deeper dreams.

Build choices should increase hidden control pressure: 技能 +1.0 control score, 棋盘 +1.2, 被动 +0.8, and 梦种 should follow the advanced-passive pressure weight. Later level clear targets should rise slightly with this score, communicating that the dream is beginning to resist being controlled without exposing the formula as a front-and-center UI system.

Board items should be sparse and dream energy should feel scarce. The first level should have no board tools or dream-energy pickups. Unassigned or blank slots should prefer small memory cards; dream energy is capped by level tier and value pressure, then used to charge Build skills or stored only when no skill has been found yet.

Levels can refill in waves after the introductory memory. The first normal level should not trigger refill waves at all. Recovered cards leave empty slots, and deeper levels refill those slots with small memory cards first, only a small capped amount of dream energy, delayed required fragments, and eventually dream anomalies. Delayed fragments should mainly appear in elite and Boss encounters.

Large or merged board slots are reserved for high-value, multi-fragment memories. Dream energy, small memories, merchant props, and interference cards must stay in single-cell slots; refill logic should be slot-compatible rather than cloning a small card into a large empty slot.

Boss and high-tier refill waves may create anomalies such as shuffle, seal, mist, and false-memory effects. These should be disruptive but solvable: they must not permanently hide required fragments, lock every available progress path, or create unavoidable failure.

Shops should offer only a tiny amount of help, usually a single supply plus a Build refresh. They should not sell a broad catalog or large quantities of props; merchant items stay scarce and separate from Build skills.

Merged memory cards should use constrained polyomino templates instead of repeating one fixed L shape. Keep shapes connected, bounded to a readable local area, non-overlapping, and limited by level tier: early normal levels use simple triomino variants, while elite and Boss levels can introduce tetromino-style T, Z, and bent shapes. Shape labels must remain readable and the board coverage validator should catch any invalid template.

Level board composition should rotate through visibly different templates, not just mirrored copies of the same layout. Avoid repeating the same large-card rhythm across adjacent memories; mix vertical corridors, horizontal bands, stair steps, T/S/Z-like blocks, and offset anchors while keeping dream energy and utility cards single-cell only.

Player success paths should support at least three overlapping strengths: strong Build choices, quick execution, and strong deduction/memory. Previewing hidden cards is not a free baseline reward; it must come from recovered Build skills, board effects, or explicit board utility cards. Match-chain preview effects should randomly choose an unseen hidden card and must not repeat cards already previewed in the same level. Previewed cards should remain visible as a semi-transparent card-face layer over the card back, clearly distinct from fully revealed cards.

Skipping a post-level Build reward should convert the offered Build value into dream time. Show the exact returned time on the skip button, but do not add a separate settlement-stat grid.

# Collaboration Preference

For larger tasks, split work across multiple focused agents when the work can proceed independently, then integrate and run a unified verification pass. Useful splits include gameplay/state logic, one-screen UI layout, card/asset visual treatment, level economy/numerical tuning, and browser QA. Keep final assembly centralized so the game remains coherent.
