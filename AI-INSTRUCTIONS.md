  The Key Pattern for Mouse Coordinates

  Always convert screen coordinates to world coordinates first:

  const world = pannerZoomer.toWorld(e.clientX, e.clientY);
  // Now use world.wx and world.wy for all calculations

  Understanding the Coordinate Spaces

  1. Screen Space: e.clientX, e.clientY - actual pixel positions on the browser window
  2. World Space: Container pixels at the original scale - this is where your elements live

  The Transform Math (from panner-zoomer.js:194-207)

  // Screen to World
  const viewportX = screenX - rect.left;  // Get position relative to viewport
  const viewportY = screenY - rect.top;
  const worldX = (viewportX - this._panX) / this._scale;  // Undo pan and zoom
  const worldY = (viewportY - this._panY) / this._scale;

  Correct Usage Pattern

  See nine-slice.js:137-152 for a perfect example:

  outer.addEventListener('pointerdown', (e) => {
    // Convert mouse position to world coordinates
    const world = pannerZoomer.toWorld(e.clientX, e.clientY);

    // Get element position in world coordinates
    const rect = outer.getBoundingClientRect();
    const worldRect = pannerZoomer.toWorld(rect.left, rect.top);

    // Calculate offset IN WORLD SPACE
    dragState = {
      offsetX: world.wx - worldRect.wx,
      offsetY: world.wy - worldRect.wy
    };
  });

  During Drag (nine-slice.js:291-298)

  function handleDragOuter(e) {
    // Convert current position to world coordinates
    const world = pannerZoomer.toWorld(e.clientX, e.clientY);

    // Calculate new position (all in world space)
    const newLeft = world.wx - dragState.offsetX;
    const newTop = world.wy - dragState.offsetY;

    // Set directly - these are already world coordinates (container pixels)
    element.style.left = newLeft + 'px';
    element.style.top = newTop + 'px';
  }

  The Critical Rule

  Never use e.clientX or e.clientY directly for positioning calculations. Always convert to world space first using toWorld(), then all your math will work correctly at any zoom/pan level.
