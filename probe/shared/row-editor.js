// probe/shared/row-editor.js
//
// Shared drag-and-drop row builder for the fun-probes (emergence / rng / wired).
// Classic script (not an ES module) so it loads fine over file:// — the "ES-module
// imports are unreliable over file://" note in each probe's inline script does NOT
// apply here, only to `import` statements.
//
// Problem this solves: the old builder could only append (click a palette token →
// pushed to the end) or remove (click/✕ a row token → spliced out). Changing one
// piece in the middle meant deleting everything from that point on and re-adding it.
// This module adds drag-and-drop REPLACE / REORDER / INSERT on top, while keeping
// every existing fast path (tap palette → append; tap row token → remove) working
// unchanged, so nothing regresses.
//
// This module owns interaction only — never token visuals (that's the caller's
// `makeCard`) and never game rules (that's the caller's `LIB`/`ORDER`/scoring).
//
// Usage:
//   const editor = createRowEditor({
//     rowEl, paletteEl,      // containers
//     order,                 // array of all ids, palette order
//     slots,                 // max row length
//     getRow, setRow,        // () => ids[]  /  (ids) => void
//     makeCard,              // (id, {removable, index, disabled}) => HTMLElement
//     onChange,              // () => void, called after any edit commits
//   });
//   editor.renderRow();
//   editor.renderPalette();

(function () {
  const DRAG_THRESHOLD = 5; // px of pointer movement before a tap becomes a drag
  const REPLACE_ZONE = 0.28; // fraction of token half-width/height counted as "center"

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement("style");
    style.textContent = `
      .re-draggable { touch-action: none; }
      .re-dragging { opacity: .32; }
      .re-replace-target {
        outline: 2px solid var(--chip, #4fc3f7);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(79,195,247,.25), 0 0 16px rgba(79,195,247,.45);
      }
      .re-ghost {
        position: fixed; top: 0; left: 0; z-index: 9999;
        pointer-events: none; opacity: .92;
        box-shadow: 0 10px 28px rgba(0,0,0,.55);
        transform: scale(1.04);
      }
      .re-caret {
        position: fixed; z-index: 9998; width: 3px; border-radius: 2px;
        background: var(--chip, #4fc3f7);
        box-shadow: 0 0 8px rgba(79,195,247,.8);
        pointer-events: none; display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function createRowEditor({ rowEl, paletteEl, order, slots, getRow, setRow, makeCard, onChange }) {
    injectStyles();

    let caretEl = null;
    function ensureCaret() {
      if (!caretEl) {
        caretEl = document.createElement("div");
        caretEl.className = "re-caret";
        document.body.appendChild(caretEl);
      }
      return caretEl;
    }
    function showCaretAt(index) {
      const rowIds = getRow();
      const children = Array.from(rowEl.children);
      if (!children.length) return;
      const caret = ensureCaret();
      let x, top, height;
      if (index <= 0) {
        const r = children[0].getBoundingClientRect();
        x = r.left - 5; top = r.top; height = r.height;
      } else if (index >= children.length) {
        const r = children[children.length - 1].getBoundingClientRect();
        x = r.right + 5; top = r.top; height = r.height;
      } else {
        const rPrev = children[index - 1].getBoundingClientRect();
        const rNext = children[index].getBoundingClientRect();
        x = (rPrev.right + rNext.left) / 2;
        top = rNext.top; height = rNext.height;
      }
      caret.style.display = "block";
      caret.style.left = x + "px";
      caret.style.top = top + "px";
      caret.style.height = height + "px";
    }
    function hideCaret() {
      if (caretEl) caretEl.style.display = "none";
    }
    function clearReplaceHighlight() {
      Array.from(rowEl.children).forEach((c) => c.classList.remove("re-replace-target"));
    }

    function computeDropTarget(x, y) {
      const rowIds = getRow();
      const children = Array.from(rowEl.children);
      if (!children.length) return { index: 0, mode: "insert" };
      let best = null, bestDist = Infinity;
      children.forEach((child, i) => {
        const r = child.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = Math.hypot(x - cx, y - cy);
        if (d < bestDist) { bestDist = d; best = { i, r, cx, cy }; }
      });
      const isFilled = best.i < rowIds.length;
      if (isFilled) {
        const withinX = Math.abs(x - best.cx) < best.r.width * REPLACE_ZONE;
        const withinY = Math.abs(y - best.cy) < best.r.height * REPLACE_ZONE;
        if (withinX && withinY) return { index: best.i, mode: "replace" };
        return { index: x < best.cx ? best.i : best.i + 1, mode: "insert" };
      }
      // nearest child is an empty slot — any empty slot means "append after filled"
      return { index: rowIds.length, mode: "insert" };
    }

    function commitDrop(source, target) {
      const rowIds = getRow().slice();
      if (source.type === "palette") {
        if (target.mode === "replace") {
          rowIds[target.index] = source.id;
        } else {
          if (rowIds.length >= slots) return; // full — insert has nowhere to go
          rowIds.splice(target.index, 0, source.id);
        }
      } else {
        // source.type === "row"
        if (target.mode === "replace") {
          if (target.index === source.index) return; // dropped on itself, no-op
          const tmp = rowIds[target.index];
          rowIds[target.index] = rowIds[source.index];
          rowIds[source.index] = tmp;
        } else {
          let idx = target.index;
          const [item] = rowIds.splice(source.index, 1);
          if (idx > source.index) idx -= 1;
          rowIds.splice(idx, 0, item);
        }
      }
      setRow(rowIds);
      renderRow();
      renderPalette();
      onChange();
    }

    function handleTap(source) {
      if (source.type === "palette") {
        const rowIds = getRow().slice();
        if (rowIds.length >= slots || rowIds.includes(source.id)) return;
        rowIds.push(source.id);
        setRow(rowIds);
      } else {
        const rowIds = getRow().slice();
        rowIds.splice(source.index, 1);
        setRow(rowIds);
      }
      renderRow();
      renderPalette();
      onChange();
    }

    function createGhost(card, x, y) {
      const rect = card.getBoundingClientRect();
      const ghost = card.cloneNode(true);
      ghost.className = card.className + " re-ghost";
      ghost.classList.remove("re-dragging");
      ghost.style.width = rect.width + "px";
      ghost.style.height = rect.height + "px";
      ghost.style.margin = "0";
      ghost._w = rect.width; ghost._h = rect.height;
      document.body.appendChild(ghost);
      moveGhost(ghost, x, y);
      return ghost;
    }
    function moveGhost(ghost, x, y) {
      ghost.style.transform = `translate(${x - ghost._w / 2}px, ${y - ghost._h / 2}px) scale(1.04)`;
    }

    function wireDrag(card, source) {
      card.classList.add("re-draggable");
      card.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY;
        let dragging = false;
        let ghost = null;
        let target = null;

        function onMove(ev) {
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            dragging = true;
            ghost = createGhost(card, ev.clientX, ev.clientY);
            card.classList.add("re-dragging");
          }
          if (dragging) {
            moveGhost(ghost, ev.clientX, ev.clientY);
            target = computeDropTarget(ev.clientX, ev.clientY);
            clearReplaceHighlight();
            hideCaret();
            if (target.mode === "replace") {
              const el = rowEl.children[target.index];
              if (el) el.classList.add("re-replace-target");
            } else {
              showCaretAt(target.index);
            }
          }
        }
        function finish() {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.removeEventListener("pointercancel", onCancel);
        }
        function onUp() {
          finish();
          if (dragging) {
            if (ghost) ghost.remove();
            card.classList.remove("re-dragging");
            clearReplaceHighlight();
            hideCaret();
            if (target) commitDrop(source, target);
          } else {
            handleTap(source);
          }
        }
        function onCancel() {
          finish();
          if (ghost) ghost.remove();
          card.classList.remove("re-dragging");
          clearReplaceHighlight();
          hideCaret();
        }

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onCancel);
      });
    }

    function renderRow() {
      const rowIds = getRow();
      rowEl.innerHTML = "";
      rowIds.forEach((id, i) => {
        const card = makeCard(id, { removable: true, index: i });
        wireDrag(card, { type: "row", id, index: i });
        rowEl.appendChild(card);
      });
      const remaining = slots - rowIds.length;
      for (let i = 0; i < remaining; i++) {
        const empty = document.createElement("div");
        empty.className = "slot-empty";
        empty.textContent = "empty";
        rowEl.appendChild(empty);
      }
    }

    function renderPalette() {
      const rowIds = getRow();
      paletteEl.innerHTML = "";
      for (const id of order) {
        const used = rowIds.includes(id);
        const card = makeCard(id, { disabled: used });
        if (!used) wireDrag(card, { type: "palette", id, index: null });
        paletteEl.appendChild(card);
      }
    }

    return { renderRow, renderPalette };
  }

  window.createRowEditor = createRowEditor;
})();
