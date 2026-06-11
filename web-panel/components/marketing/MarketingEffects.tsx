"use client";

import { useEffect, useRef } from "react";

export default function MarketingEffects() {
  const glowRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    items.forEach((item) => observer.observe(item));
    const move = (event: PointerEvent) => {
      if (!reduced && glowRef.current) glowRef.current.style.transform = `translate3d(${event.clientX - 240}px,${event.clientY - 240}px,0)`;
    };
    const scroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    };
    addEventListener("pointermove", move, { passive: true });
    addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => { observer.disconnect(); removeEventListener("pointermove", move); removeEventListener("scroll", scroll); };
  }, []);

  return <><div ref={progressRef} className="marketing-progress"/><div ref={glowRef} className="marketing-cursor-glow"/></>;
}
