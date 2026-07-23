# Feature Specification: Mobile Fullscreen Canvas & Drawing Tools

**Feature Branch**: `003-mobile-canvas-tools`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "En mode mobile il faut que le canvas fasse toute la taille de l'écran. Trouve une librairie pour avoir des outils comme une gomme, changer la couleur, la taille du trait etc dans le canvas"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full-Screen Drawing Canvas on Mobile (Priority: P1)

As a player joining a drawing round on a mobile phone, I want my screen reduced to a single header showing the phrase/question and my canvas filling every remaining pixel, so that I have maximum space to draw the phrase clearly, without wasted margins or areas cut off by the mobile browser's address bar showing or hiding.

**Why this priority**: This is the most visible pain point and affects every mobile player's drawing experience — mobile is the primary device most players use, so a cramped or clipped canvas directly limits drawing quality and satisfaction.

**Independent Test**: Load the drawing screen on a mobile device (or an emulated mobile viewport) in both portrait and landscape orientations, with the browser's address bar visible and then collapsed; verify the screen shows only the phrase/question header, and the canvas visibly fills all remaining space in every state without gaps, clipping, or scrollbars.

**Acceptance Scenarios**:

1. **Given** a player opens their drawing screen on a mobile phone in portrait orientation, **When** the page loads, **Then** the screen shows only a header containing the phrase/question, and the canvas fills 100% of the remaining screen height and width, with no other UI element or empty margin taking up space.
2. **Given** a player is drawing on mobile and the browser's address bar collapses or reappears (common on scroll/interaction), **When** the viewport height changes, **Then** the canvas resizes to continue filling the available space without clipping any drawn content or leaving gaps.
3. **Given** a player rotates their device from portrait to landscape mid-round, **When** the orientation changes, **Then** the canvas immediately re-fills the new available screen space and previously drawn strokes keep their exact original position (same coordinates as drawn); strokes that fall outside the new, smaller dimension are not required to remain visible, matching the app's existing resize behavior.

---

### User Story 2 - Erase Drawing Mistakes (Priority: P1)

As a player drawing a phrase, I want to erase parts of my drawing that I got wrong, so that I can correct mistakes without starting my entire drawing over.

**Why this priority**: Mistakes during freehand drawing are inevitable; without a correction tool, players must abandon and restart, which is frustrating and wastes time in a timed round.

**Independent Test**: Draw several strokes on the canvas, switch to the eraser tool, drag over part of the drawing, and verify that only the touched marks are removed while the rest of the drawing remains intact.

**Acceptance Scenarios**:

1. **Given** a player has drawn strokes on their canvas, **When** they select the eraser tool and drag over a portion of the drawing, **Then** the marks under the eraser path are removed while the rest of the drawing is unaffected.
2. **Given** a player is in eraser mode, **When** they lift their finger/pointer and touch a new area, **Then** only that new contact area is erased (the eraser behaves as a precise tool, not a "clear entire canvas" action).
3. **Given** a player has erased part of their drawing, **When** they switch back to the drawing tool, **Then** they can resume drawing normally with their previously selected color and size.

---

### User Story 3 - Change Stroke Color (Priority: P2)

As a player drawing a phrase, I want to choose a different color for my strokes, so that I can better represent or emphasize parts of my drawing.

**Why this priority**: Adds expressiveness and drawing quality, but the game remains functional without it — a round can still be completed with a single default color.

**Independent Test**: Open the color control, select a different color, draw a stroke, and verify the new stroke renders in the selected color while earlier strokes retain their original color.

**Acceptance Scenarios**:

1. **Given** a player is on their drawing screen, **When** they open the color control and select a new color, **Then** subsequent strokes are drawn in that color.
2. **Given** a player has drawn strokes in one color and then switches color, **When** they draw additional strokes, **Then** earlier strokes keep their original color unchanged.

---

### User Story 4 - Adjust Stroke Size (Priority: P3)

As a player drawing a phrase, I want to adjust how thick or thin my strokes are, so that I can draw fine details or bold lines as needed.

**Why this priority**: Enhances drawing precision and expressiveness but is the least critical of the requested tools — a fixed stroke width is still usable for most phrases.

**Independent Test**: Open the stroke size control, select a different size, draw a stroke, and verify the new stroke renders at the selected thickness while earlier strokes retain their original thickness.

**Acceptance Scenarios**:

1. **Given** a player is on their drawing screen, **When** they select a different stroke size, **Then** subsequent strokes are drawn at that thickness.
2. **Given** a player has drawn strokes at one size and then changes size, **When** they draw additional strokes, **Then** earlier strokes keep their original thickness unchanged.

---

### Edge Cases

- What happens when a player switches tools (draw/erase) mid-stroke, while their finger is still on the screen?
- How does the system handle a player selecting a color that is very close to or identical to the canvas background color (nearly invisible strokes)?
- What happens if a player rapidly toggles between draw and erase modes?
- How does the canvas behave on devices with notches or rounded screen corners — are toolbar controls or the drawable area obstructed?
- What happens to the full-screen canvas if an on-screen keyboard or another overlay appears?
- What happens to in-progress tool selections (color/size/mode) if a player's connection drops and reconnects mid-round?
- How does the eraser behave at the very edge of the canvas or over an already-blank area?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On mobile viewports, the drawing screen MUST show only a single header containing the phrase/question, with the drawing canvas occupying all remaining screen space, in both portrait and landscape orientation.
- **FR-002**: The canvas MUST remain filling the available screen space when the mobile browser's UI chrome (e.g., address bar) shows or hides, without clipping drawn content or leaving visible gaps.
- **FR-003**: The canvas MUST resize and keep all previously drawn strokes correctly positioned when the device orientation changes.
- **FR-004**: System MUST provide an eraser tool that removes drawn marks at the point of contact, leaving the rest of the drawing unaffected.
- **FR-005**: System MUST let the player switch between drawing and erasing modes during a round.
- **FR-006**: System MUST provide a color selection control allowing players to choose any color, not limited to a fixed preset palette, for new strokes.
- **FR-007**: System MUST provide a stroke size control allowing players to adjust stroke thickness across a continuous range for new strokes.
- **FR-008**: Changing color, size, or tool mode MUST only affect strokes drawn after the change; previously drawn strokes MUST retain their original appearance.
- **FR-009**: Tool controls (color, size, eraser) MUST be reachable without permanently covering or shrinking the drawable canvas area.
- **FR-010**: The player's current tool selection (color, size, mode) MUST persist for the remainder of the drawing round, not reset unexpectedly on resize or orientation change.
- **FR-011**: The full-screen, header-plus-canvas layout applies to the player's private drawing canvas. The host's secondary canvas panel is out of scope for this feature.

### Key Entities *(include if feature involves data)*

- **Drawing Tool Selection**: The player's currently active drawing settings — selected color, selected stroke size, and active mode (draw or erase). Scoped per player, per session.
- **Stroke**: A single continuous drawn (or erased) mark; already tracked by the system, now carrying the color, size, and mode that were active when it was made.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On mobile devices, the drawing canvas visibly fills 100% of the available screen area (no visible gaps or clipped edges), across common mobile browsers, in both orientations.
- **SC-002**: Players can switch their stroke color in 2 taps or fewer from the drawing screen.
- **SC-003**: Players can switch their stroke size in 2 taps or fewer from the drawing screen.
- **SC-004**: Players can correct a drawing mistake with the eraser, in under 5 seconds from mistake to corrected canvas, without restarting their drawing.
- **SC-005**: In usability testing, at least 90% of players can locate and successfully use the color, size, and eraser controls without external instructions.
- **SC-006**: Drawing responsiveness (stroke rendering lag) is not perceptibly degraded after the new tools are added, as judged by players in side-by-side comparison.

## Assumptions

- The feature applies to the existing mobile drawing screen used by players during a round; desktop/tablet layouts are already adequately sized and are not the primary target of the full-screen fix, though they must not regress.
- The host's secondary canvas panel is explicitly out of scope; only the player's drawing screen is affected by this feature.
- **Technical direction (stakeholder decision)**: the canvas and its toolbar (color, size, eraser) will be implemented using the Fabric.js library, superseding the current hand-rolled Canvas 2D drawing code. This is a deliberate exception to the project's general minimal-dependency preference, made explicitly for this feature; it should be captured and justified in the implementation plan.
- Each player's canvas remains private during drawing, as it is today; adding tools does not change who can see a player's drawing.
- "Erase" means removing marks at the point of contact (a precision eraser), not a single action that clears the entire canvas at once.
- Tool selection (color, size, mode) is local to each player's own drawing session and does not need to sync to other players or the host.
- Tool selection (color, size, mode) persists not just across resize/orientation change (FR-010) but also across a new round/phrase within the same session (i.e., it is not reset by the existing "clear drawing" action) — carrying a player's preference forward is the more useful default and requires no extra logic to reset it.
- On orientation change, previously drawn strokes keep their original coordinates rather than being proportionally rescaled to the new canvas size (matching the app's existing, pre-feature resize behavior). A stroke positioned near an edge may fall outside the canvas after rotating to a smaller dimension; this is an accepted limitation, not a new regression introduced by this feature.
