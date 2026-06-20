**Source Visual Truth**
- Path: `/Users/awis/Documents/CodexWeb_Game002/reference-moon-grid.png`
- Latest board-background note source: `/var/folders/zn/kpz9wl5j5rn1v6ygy3_c18hc0000gn/T/codex-clipboard-5a28909f-04fe-4ca3-9830-e49f4c918342.png`

**Implementation Evidence**
- Local URL: `http://127.0.0.1:5175/`
- Latest start-screen screenshot: `/Users/awis/Documents/CodexWeb_Game002/qa-start-screen-story.png`
- Latest screenshot: `/Users/awis/Documents/CodexWeb_Game002/qa-board-background.png`
- Previous screenshot: `/private/tmp/codex-game002-mobile-393-latest.png`
- Full-view comparison: source image opened from the path above and latest implementation captured with Chrome headless after the in-app browser tab failed to attach.
- Viewport: `430 x 932` for the latest board-background check; previous QA used `393 x 852`
- State: active memory-board level with one-screen layout

**Findings**
- No actionable P0/P1/P2 issues remain.
- Latest start-screen check passes: the opening screen now leads with generated memory-atmosphere artwork and concise story copy instead of an empty board preview.
- Active-play top-right controls are constrained to two actions only: audio and 图鉴.
- Latest board-background check passes: the board base texture is now rendered as one continuous oversized layer under the grid, clipped by the board mask, so the source image's outer gold frame and corner ornaments no longer appear as board-base lines.
- Visible gold strokes in the latest screenshot are from card borders/card-back artwork and intentional UI framing, not from the board-base background.
- The implementation preserves the selected direction's mobile hierarchy: compact status bar, moon/title area, central merged-grid board, skill dock, and dream route strip.
- The grid implementation uses actual multi-cell regions, including a 2x2 block, vertical merged blocks, a 2x2 bottom block, and an L-shaped block.
- The gameplay screenshot is intentionally more hidden than the reference mock, because the fresh state starts with face-down memory tiles; revealed labels and item identities appear through card flips or the preview action.
- Unknown future route nodes now render as `?`, so the route strip no longer exposes unselected map choices.
- Matched/acquired cards disappear during active play and are restored only in settlement recap, reducing board noise without losing the full-board end state.
- The bottom dock now represents run Build skill slots rather than temporary board-item inventory; board utility cards resolve immediately or charge Build skills through energy.

**Required Fidelity Surfaces**
- Fonts and typography: readable Chinese serif/system stack, stable numeric hierarchy, no observed clipping at 390px.
- Spacing and layout rhythm: all primary sections fit the mobile viewport; title no longer wraps; controls remain tappable.
- Colors and visual tokens: dark moonlit archive palette, gold/teal accents, red penalty copy, and subdued grid lines match the chosen direction.
- Image quality and asset fidelity: item art is implemented with a consistent icon-library style for the playable prototype; detailed generated item illustrations remain a P3 polish opportunity.
- Copy and content: Chinese UI covers time, target value, acquired value, fragment labels, skills, shop, rest, and route nodes.

**Patches Made Since Previous QA Pass**
- Removed duplicate map choice rendering after rewards.
- Fixed saved-run hydration so map state no longer restores an old level after reload.
- Reduced face-down tile text noise and kept only the moon sigil.
- Prevented the title from wrapping at the target mobile width.
- Replaced the default mouse-click focus ring with a controlled keyboard focus style.
- Restyled the mobile shell toward the reference mock: tighter top bar, stronger gold/teal board framing, richer merged-card surfaces, and dashed unknown route nodes.
- Changed clear logic so a level succeeds when all valuable core cards are completed or the paid level budget is exhausted; utility cards no longer block clear.
- Changed difficulty distribution so elite/Boss large valuable cards require matching associated small fragments instead of being instant pickups.
- Changed active-board collected state to disappear visually after matching.
- Reworked the active skill dock into Build skill slots with charge counters, added energy-card charging, and changed shop/rest rewards to feed Build energy or shields instead of old inventory buttons.
- Changed route-choice cards from compact horizontal tiles to large vertical decision cards so the map panel no longer feels empty.
- Restored the reference bottom structure: three visible Build skill cards on the left and a separate merchant item card on the right.
- Restored the merchant item `记忆卷轴 25` as an active-level purchasable prop instead of hiding all shop items behind route shop nodes.
- Added base Build skills `指引 / 回溯 / 定时锁定` with reference-like charge states and working effects.
- Removed screenshot-crop UI chrome from the playable top UI and replaced it with controlled CSS/icon treatment so spacing and readability remain adjustable.
- Restored the top information hierarchy to match the reference: `时间 / 目标价值 / 已获价值`, separate `档案 / 设置` buttons, and a same-row layer panel with `记忆干扰：时间 -X秒`.
- Reduced the title and metric typography and changed the top panels to thinner, darker, clipped dashboard styling.
- Increased horizontal separation between the top information group and right-side buttons, and widened the layer/interference panel so `记忆干扰：时间 -5秒` does not clip.
- Reworked `.memory-board` so the board base image lives in an oversized absolute background layer, with the board container masking overflow and no direct 100% stretched frame image.
- Reworked the start screen around `start-memory-atmosphere-v1.png`, added narrative copy about recovering lost self-fragments, and removed the empty-board preview from the opening state.
- Restored the top status action grid to two right-side buttons after confirming reset/settings should not appear there.

**Verification**
- Production build passed with `npm run build` after the board-background change.
- Production build passed with `npm run build` after the start-screen and top-action correction.
- TypeScript check passed with `npx tsc --noEmit` after the start-screen and top-action correction.
- Chrome headless screenshot captured the new story-led start screen at `/Users/awis/Documents/CodexWeb_Game002/qa-start-screen-story.png`.
- Chrome headless screenshot captured the latest active level at `430 x 932`; board-base frame lines are cropped out, and the background layer remains behind cards/overlays.
- TypeScript check passed with `npx tsc --noEmit`.
- Browser console error log was empty.
- Manual interaction checks passed for mismatch penalty, instant time item, full fragment completion, level reward, route persistence after reload, rest node, and shop purchase.
- Browser layout check at `393 x 852` showed no vertical overflow; status bar remained inside the viewport; route nodes rendered as `起点 / 普通 / ? / ? / ? / ?`.
- Browser layout check after the Build dock change showed `Build技能` with four empty reward slots on the current no-skill run and no vertical overflow.
- Production build passed after the large route-card layout change; current automated browser state was an active level, so route-card visual verification is pending the next map state.
- Browser layout check after restoring the reference dock showed `指引 1/2`, `回溯 1/1`, `定时锁定 0/2`, and `记忆卷轴 25` at `393 x 852` with no vertical overflow.
- Browser layout check after restoring the top UI showed `时间 / 目标价值 / 已获价值`, `当前层数 1/15`, and no vertical overflow at `393 x 852`; the layer panel width is 230px and its interference text has matching scroll/client width.

**Follow-up Polish**
- P3: generate bespoke transparent item art for the major revealed card faces if the next iteration needs closer visual fidelity to the reference image.
- P3: add richer route-branch illustration once map generation becomes more important than the current playable loop.

final result: passed
