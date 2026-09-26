"use client";

import { useLayoutEffect, useRef } from "react";

const GAP = 6;
const MARGIN = 8;

/**
 * A dropdown that floats over whatever holds it. Inside a modal `<dialog>` an
 * absolutely placed panel is cut off by the dialog's own scrolling box, and a
 * portal to `<body>` would sit under the dialog, which is in the top layer.
 * A popover joins the top layer too, above the dialog, so the panel is shown
 * as one and placed by hand next to its anchor: below it, or above it when
 * there is more room there, and kept inside the viewport's sides.
 *
 * The panel stays in the anchor's DOM subtree, so focus, form fields and
 * "click outside" checks behave as they did.
 */
export function useFloatingPanel<
  TAnchor extends HTMLElement = HTMLButtonElement,
>(open: boolean, align: "start" | "end" = "start") {
  const anchor = useRef<TAnchor>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const target = anchor.current;
    const floating = panel.current;
    if (!open || !target || !floating) return;

    // Set here rather than rendered: where the Popover API is missing (older
    // browsers, jsdom) the attribute alone would hide the panel. Without it
    // the panel keeps its fixed position, which still escapes the dialog's
    // scrolling box, though not the top layer.
    if (typeof floating.showPopover === "function") {
      floating.setAttribute("popover", "manual");
      floating.showPopover();
    }

    const place = () => {
      const box = target.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = floating;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;

      const wanted = align === "end" ? box.right - width : box.left;
      const left = Math.max(
        MARGIN,
        Math.min(wanted, viewportWidth - width - MARGIN),
      );
      const below = viewportHeight - box.bottom - GAP - MARGIN;
      const above = box.top - GAP - MARGIN;
      const top =
        height <= below || below >= above
          ? box.bottom + GAP
          : box.top - GAP - height;

      floating.style.left = `${left}px`;
      floating.style.top = `${Math.max(MARGIN, top)}px`;
    };

    place();
    // The panel's height changes as a search narrows its list.
    const resized =
      typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    resized?.observe(floating);
    // Capture, so scrolling the dialog's body moves the panel with the anchor.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      resized?.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      if (
        typeof floating.hidePopover === "function" &&
        floating.matches(":popover-open")
      ) {
        floating.hidePopover();
      }
    };
  }, [open, align]);

  return { anchor, panel };
}

/**
 * The classes a floating panel needs on top of its own look: fixed, and none
 * of the popover's default centring, border or scrolling.
 */
export const FLOATING_PANEL = "fixed inset-auto m-0 overflow-visible z-30";
