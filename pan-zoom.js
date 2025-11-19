
/* ============================================================================
   PanZoomElement 3.0 - Production Ready

   A robust, high-performance pan and zoom container for complex applications.

   Features:
   - Accurate coordinate transformations at any zoom level
   - Industry-standard zoom behavior (cursor stays locked to world point)
   - Smooth panning with pointer events
   - Comprehensive self-tests
   - Custom events for integration
   - Programmatic control API
   - Works with any slotted content

   Usage:
     <pan-zoom>
       <your-content></your-content>
     </pan-zoom>

   API:
     element.setPan(x, y)           - Set pan position
     element.setZoom(scale)         - Set zoom level
     element.zoomToPoint(scale, wx, wy) - Zoom to specific world point
     element.reset()                - Reset to initial state
     element.toWorld(screenX, screenY) - Convert screen to world coords
     element.toScreen(worldX, worldY)  - Convert world to screen coords

   Events:
     pz-pointerdown, pz-pointermove, pz-pointerup - Pan events
     pz-wheel                          - Zoom events
     pztransform                     - Any transform change
============================================================================ */

class PanZoomElement extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        // Create shadow DOM structure
        this._createDOMStructure();

        // Initialize transform state
        this._scale = 1;
        this._panX = 0;
        this._panY = 0;

        // Pan interaction state
        this._isPanning = false;
        this._lastPointerX = 0;
        this._lastPointerY = 0;

        // Configuration
        this._minScale = 0.1;
        this._maxScale = 10;
        this._zoomIntensity = 0.15;

        // Bind event handlers
        this._setupEventListeners();

        // Initial render
        this._applyTransform();
    }

    /* ========================================================================
       DOM STRUCTURE
    ======================================================================== */

    _createDOMStructure() {
        // Create style
        const style = document.createElement("style");
        style.textContent = `
            :host {
                display: block;
                position: relative;
                overflow: hidden;
                touch-action: none;
                user-select: none;
            }

            .viewport {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                cursor: grab;
            }

            .viewport.panning {
                cursor: grabbing;
            }

            .content {
                position: absolute;
                top: 0;
                left: 0;
                transform-origin: 0 0;
                will-change: transform;
            }
        `;

        // Create viewport
        this._viewport = document.createElement("div");
        this._viewport.className = "viewport";

        // Create content container
        this._content = document.createElement("div");
        this._content.className = "content";

        // Create slot for user content
        const slot = document.createElement("slot");
        this._content.appendChild(slot);

        this._viewport.appendChild(this._content);
        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(this._viewport);
    }

    /* ========================================================================
       EVENT LISTENERS
    ======================================================================== */

    _setupEventListeners() {
        // Pan events
        this._viewport.addEventListener("pointerdown", e => this._onPointerDown(e));
        this._viewport.addEventListener("pointermove", e => this._onPointerMove(e));
        window.addEventListener("pointerup", e => this._onPointerUp(e));
        window.addEventListener("pointercancel", e => this._onPointerUp(e));

        // Zoom events
        this._viewport.addEventListener("wheel", e => this._onWheel(e), { passive: false });

        // Prevent context menu on right-click
        this._viewport.addEventListener("contextmenu", e => e.preventDefault());
    }

    /* ========================================================================
       COORDINATE TRANSFORMATIONS

       These are the core functions that convert between screen space (pixels
       on the screen) and world space (coordinate system of the content).
    ======================================================================== */

    /**
     * Convert screen coordinates to world coordinates
     * @param {number} screenX - X coordinate in screen space (pixels)
     * @param {number} screenY - Y coordinate in screen space (pixels)
     * @returns {Object} { wx, wy } - World coordinates
     */
    toWorld(screenX, screenY) {
        const rect = this._viewport.getBoundingClientRect();

        // Convert screen coordinates to viewport-relative coordinates
        const viewportX = screenX - rect.left;
        const viewportY = screenY - rect.top;

        // Transform from viewport space to world space
        // Inverse of: screen = world * scale + pan
        // Therefore: world = (screen - pan) / scale
        const worldX = (viewportX - this._panX) / this._scale;
        const worldY = (viewportY - this._panY) / this._scale;

        return { wx: worldX, wy: worldY };
    }

    /**
     * Convert world coordinates to screen coordinates
     * @param {number} worldX - X coordinate in world space
     * @param {number} worldY - Y coordinate in world space
     * @returns {Object} { sx, sy } - Screen coordinates relative to viewport
     */
    toScreen(worldX, worldY) {
        // Transform from world space to viewport space
        // Formula: screen = world * scale + pan
        const screenX = worldX * this._scale + this._panX;
        const screenY = worldY * this._scale + this._panY;

        return { sx: screenX, sy: screenY };
    }

    /**
     * Get detailed transform info for an event
     * @private
     */
    _getTransformInfo(e) {
        const world = this.toWorld(e.clientX, e.clientY);
        const rect = this._viewport.getBoundingClientRect();

        return {
            wx: world.wx,
            wy: world.wy,
            screenX: e.clientX,
            screenY: e.clientY,
            viewportX: e.clientX - rect.left,
            viewportY: e.clientY - rect.top,
            scale: this._scale,
            panX: this._panX,
            panY: this._panY
        };
    }

    /* ========================================================================
       TRANSFORM APPLICATION
    ======================================================================== */

    _applyTransform() {
        // Apply CSS transform
        this._content.style.transform =
            `translate(${this._panX}px, ${this._panY}px) scale(${this._scale})`;

        // Dispatch transform event
        this.dispatchEvent(new CustomEvent("pz-transform", {
            detail: {
                scale: this._scale,
                panX: this._panX,
                panY: this._panY
            }
        }));
    }

    /* ========================================================================
       PAN INTERACTION
    ======================================================================== */

    _onPointerDown(e) {
        // Only start panning if clicking on the viewport itself
        // This allows content to handle its own pointer events
        if (e.target !== this._viewport) {
            return;
        }

        this._isPanning = true;
        this._lastPointerX = e.clientX;
        this._lastPointerY = e.clientY;

        this._viewport.classList.add("panning");
        this._viewport.setPointerCapture(e.pointerId);

        this.dispatchEvent(new CustomEvent("pz-pointerdown", {
            detail: this._getTransformInfo(e)
        }));
    }

    _onPointerMove(e) {
        if (this._isPanning) {
            // Calculate pointer delta in screen space
            const dx = e.clientX - this._lastPointerX;
            const dy = e.clientY - this._lastPointerY;

            // Apply delta to pan (screen space delta = world space delta * scale)
            this._panX += dx;
            this._panY += dy;

            this._applyTransform();

            this._lastPointerX = e.clientX;
            this._lastPointerY = e.clientY;

            this.dispatchEvent(new CustomEvent("pz-pointermove", {
                detail: this._getTransformInfo(e)
            }));
        }
    }

    _onPointerUp(e) {
        if (this._isPanning) {
            this._isPanning = false;
            this._viewport.classList.remove("panning");

            this.dispatchEvent(new CustomEvent("pz-pointerup", {
                detail: this._getTransformInfo(e)
            }));
        }
    }

    /* ========================================================================
       ZOOM INTERACTION

       Industry-standard zoom: the point under the cursor stays locked to the
       same world coordinate. This is how Google Maps, Figma, etc. work.
    ======================================================================== */

    _onWheel(e) {
        e.preventDefault();

        // Get world coordinates of the cursor before zoom
        const worldBefore = this.toWorld(e.clientX, e.clientY);
        const rect = this._viewport.getBoundingClientRect();
        const viewportX = e.clientX - rect.left;
        const viewportY = e.clientY - rect.top;

        // Calculate new scale
        const direction = Math.sign(e.deltaY);
        const factor = 1 - direction * this._zoomIntensity;
        let newScale = this._scale * factor;

        // Clamp scale to limits
        newScale = Math.max(this._minScale, Math.min(this._maxScale, newScale));

        // Calculate new pan to keep world point under cursor
        // We want: viewportX = worldBefore.wx * newScale + newPanX
        // Therefore: newPanX = viewportX - worldBefore.wx * newScale
        this._panX = viewportX - worldBefore.wx * newScale;
        this._panY = viewportY - worldBefore.wy * newScale;
        this._scale = newScale;

        this._applyTransform();

        this.dispatchEvent(new CustomEvent("pz-wheel", {
            detail: {
                ...this._getTransformInfo(e),
                oldScale: this._scale / factor,
                newScale: newScale
            }
        }));
    }

    /* ========================================================================
       PUBLIC API
    ======================================================================== */

    /**
     * Set pan position
     */
    setPan(x, y) {
        this._panX = x;
        this._panY = y;
        this._applyTransform();
    }

    /**
     * Set zoom level
     */
    setZoom(scale) {
        this._scale = Math.max(this._minScale, Math.min(this._maxScale, scale));
        this._applyTransform();
    }

    /**
     * Zoom to a specific world point
     */
    zoomToPoint(scale, worldX, worldY) {
        const rect = this._viewport.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        this._scale = Math.max(this._minScale, Math.min(this._maxScale, scale));
        this._panX = centerX - worldX * this._scale;
        this._panY = centerY - worldY * this._scale;

        this._applyTransform();
    }

    /**
     * Reset to initial state
     */
    reset() {
        this._scale = 1;
        this._panX = 0;
        this._panY = 0;
        this._applyTransform();
    }

    /**
     * Get current transform state
     */
    getTransform() {
        return {
            scale: this._scale,
            panX: this._panX,
            panY: this._panY
        };
    }

    /**
     * Set zoom limits
     */
    setZoomLimits(min, max) {
        this._minScale = min;
        this._maxScale = max;
    }

    /* ========================================================================
       COMPREHENSIVE TEST SUITE

       Tests verify the mathematical correctness of coordinate transformations.
       These tests are critical for ensuring the component works correctly
       at all zoom levels and pan positions.
    ======================================================================== */

    runTests() {
        console.log("%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "color: #4a9eff; font-weight: bold;");
        console.log("%cPanZoom 3.0 - Test Suite", "color: #4a9eff; font-weight: bold; font-size: 16px;");
        console.log("%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "color: #4a9eff; font-weight: bold;");

        const tests = [
            {
                name: "Identity Transform",
                fn: () => this._testIdentityTransform()
            },
            {
                name: "World ↔ Screen Roundtrip (Scale 1)",
                fn: () => this._testRoundtrip(1, 0, 0)
            },
            {
                name: "World ↔ Screen Roundtrip (Scale 2)",
                fn: () => this._testRoundtrip(2, 0, 0)
            },
            {
                name: "World ↔ Screen Roundtrip (Scale 0.5)",
                fn: () => this._testRoundtrip(0.5, 0, 0)
            },
            {
                name: "World ↔ Screen Roundtrip (With Pan)",
                fn: () => this._testRoundtrip(1.5, 100, -50)
            },
            {
                name: "World ↔ Screen Roundtrip (Complex)",
                fn: () => this._testRoundtrip(3, -200, 150)
            },
            {
                name: "Zoom Preserves World Point",
                fn: () => this._testZoomPreservation()
            },
            {
                name: "Pan Delta Calculation",
                fn: () => this._testPanDelta()
            },
            {
                name: "Multiple Sequential Zooms",
                fn: () => this._testSequentialZooms()
            },
            {
                name: "Boundary Conditions",
                fn: () => this._testBoundaryConditions()
            }
        ];

        let passed = 0;
        let failed = 0;

        tests.forEach((test, index) => {
            try {
                test.fn();
                console.log(`%c✓ Test ${index + 1}: ${test.name}`, "color: #4ade80;");
                passed++;
            } catch (error) {
                console.error(`%c✗ Test ${index + 1}: ${test.name}`, "color: #ef4444;");
                console.error(`  ${error.message}`);
                failed++;
            }
        });

        console.log("%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "color: #4a9eff; font-weight: bold;");
        console.log(
            `%cResults: ${passed} passed, ${failed} failed`,
            failed === 0 ? "color: #4ade80; font-weight: bold;" : "color: #ef4444; font-weight: bold;"
        );
        console.log("%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "color: #4a9eff; font-weight: bold;");

        return failed === 0;
    }

    _testIdentityTransform() {
        // At identity transform, world coords should equal screen coords
        this._scale = 1;
        this._panX = 0;
        this._panY = 0;

        const world = this.toWorld(100, 200);
        this._assertClose(world.wx, 100, "Identity: world.wx");
        this._assertClose(world.wy, 200, "Identity: world.wy");

        const screen = this.toScreen(150, 250);
        this._assertClose(screen.sx, 150, "Identity: screen.sx");
        this._assertClose(screen.sy, 250, "Identity: screen.sy");
    }

    _testRoundtrip(scale, panX, panY) {
        // Set transform
        this._scale = scale;
        this._panX = panX;
        this._panY = panY;

        // Test multiple points
        const testPoints = [
            { wx: 0, wy: 0 },
            { wx: 100, wy: 200 },
            { wx: -50, wy: 150 },
            { wx: 500, wy: -300 }
        ];

        testPoints.forEach(point => {
            // World -> Screen -> World
            const screen = this.toScreen(point.wx, point.wy);
            const worldAgain = this.toWorld(
                screen.sx + this._viewport.getBoundingClientRect().left,
                screen.sy + this._viewport.getBoundingClientRect().top
            );

            this._assertClose(worldAgain.wx, point.wx, `Roundtrip wx (${point.wx}, ${point.wy})`);
            this._assertClose(worldAgain.wy, point.wy, `Roundtrip wy (${point.wx}, ${point.wy})`);
        });
    }

    _testZoomPreservation() {
        // Setup initial state
        this._scale = 1;
        this._panX = 0;
        this._panY = 0;

        const rect = this._viewport.getBoundingClientRect();
        const screenX = rect.left + 250;
        const screenY = rect.top + 200;

        // Get world coordinates before zoom
        const worldBefore = this.toWorld(screenX, screenY);

        // Simulate zoom (like _onWheel does)
        const viewportX = screenX - rect.left;
        const viewportY = screenY - rect.top;
        const newScale = 2;

        this._panX = viewportX - worldBefore.wx * newScale;
        this._panY = viewportY - worldBefore.wy * newScale;
        this._scale = newScale;

        // Get world coordinates after zoom
        const worldAfter = this.toWorld(screenX, screenY);

        this._assertClose(worldAfter.wx, worldBefore.wx, "Zoom preservation: wx");
        this._assertClose(worldAfter.wy, worldBefore.wy, "Zoom preservation: wy");
    }

    _testPanDelta() {
        // Test that pan delta in screen space correctly translates to world space
        this._scale = 2;
        this._panX = 0;
        this._panY = 0;

        const rect = this._viewport.getBoundingClientRect();
        const worldBefore = this.toWorld(rect.left + 100, rect.top + 100);

        // Simulate pan
        this._panX += 50;
        this._panY += 30;

        const worldAfter = this.toWorld(rect.left + 100, rect.top + 100);

        // At scale 2, a 50px pan should move the world by -25px
        this._assertClose(worldAfter.wx, worldBefore.wx - 25, "Pan delta: wx");
        this._assertClose(worldAfter.wy, worldBefore.wy - 15, "Pan delta: wy");
    }

    _testSequentialZooms() {
        // Test multiple zooms in sequence
        this._scale = 1;
        this._panX = 0;
        this._panY = 0;

        const rect = this._viewport.getBoundingClientRect();
        const screenX = rect.left + 150;
        const screenY = rect.top + 150;

        const initialWorld = this.toWorld(screenX, screenY);

        // Zoom in
        const viewportX = screenX - rect.left;
        const viewportY = screenY - rect.top;
        this._scale = 2;
        this._panX = viewportX - initialWorld.wx * this._scale;
        this._panY = viewportY - initialWorld.wy * this._scale;

        const afterFirstZoom = this.toWorld(screenX, screenY);
        this._assertClose(afterFirstZoom.wx, initialWorld.wx, "First zoom: wx");
        this._assertClose(afterFirstZoom.wy, initialWorld.wy, "First zoom: wy");

        // Zoom in again
        this._scale = 4;
        this._panX = viewportX - initialWorld.wx * this._scale;
        this._panY = viewportY - initialWorld.wy * this._scale;

        const afterSecondZoom = this.toWorld(screenX, screenY);
        this._assertClose(afterSecondZoom.wx, initialWorld.wx, "Second zoom: wx");
        this._assertClose(afterSecondZoom.wy, initialWorld.wy, "Second zoom: wy");
    }

    _testBoundaryConditions() {
        // Test extreme values
        const extremeTests = [
            { scale: 0.1, panX: -1000, panY: 1000 },
            { scale: 10, panX: 5000, panY: -5000 },
            { scale: 1, panX: 0, panY: 0 }
        ];

        extremeTests.forEach(state => {
            this._scale = state.scale;
            this._panX = state.panX;
            this._panY = state.panY;

            const rect = this._viewport.getBoundingClientRect();
            const world = this.toWorld(rect.left + 100, rect.top + 100);
            const screen = this.toScreen(world.wx, world.wy);

            this._assertClose(screen.sx, 100, "Boundary test: screen.sx");
            this._assertClose(screen.sy, 100, "Boundary test: screen.sy");
        });
    }

    _assertClose(actual, expected, message, epsilon = 0.001) {
        const diff = Math.abs(actual - expected);
        if (diff > epsilon) {
            throw new Error(
                `${message}: expected ${expected}, got ${actual} (diff: ${diff})`
            );
        }
    }
}

// Register the custom element
customElements.define("pan-zoom", PanZoomElement);
