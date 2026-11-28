import { useEffect, useRef, useState, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export const BX_EASE = [0.22, 1, 0.36, 1] as const

export const BX_PAGE_TRANSITION = {
  duration: 0.2,
  ease: BX_EASE,
} as const

export const BX_OVERLAY_TRANSITION = {
  duration: 0.16,
  ease: BX_EASE,
} as const

/**
 * GSAP staggered card/item entrance inside a ref container.
 * Uses only GPU-composited transform & opacity, clears inline transforms after completion,
 * and skips movement cleanly when prefers-reduced-motion is active.
 */
export function useGsapStagger(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  triggerKey: unknown,
  reducedMotion: boolean,
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el || reducedMotion) return

    const targets = el.querySelectorAll(selector)
    if (targets.length === 0) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.34,
          stagger: 0.045,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
      )
    }, el)

    return () => ctx.revert()
  }, [containerRef, reducedMotion, selector, triggerKey])
}

/**
 * Restrained GSAP ScrollTrigger section reveals for dashboard blocks.
 * On narrow mobile viewports (<640px) or reduced-motion, disables scroll scrubbing/slide
 * so mobile scrolling stays instantaneous with zero stutter.
 */
export function useGsapScrollSections(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  reducedMotion: boolean,
) {
  useEffect(() => {
    const root = containerRef.current
    if (!root || reducedMotion) return

    const isSmallMobile = typeof window !== 'undefined' && window.innerWidth < 640
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector))
    if (nodes.length === 0) return

    const ctx = gsap.context(() => {
      nodes.forEach((node) => {
        if (isSmallMobile) {
          gsap.fromTo(
            node,
            { opacity: 0.92 },
            { opacity: 1, duration: 0.2, ease: 'power1.out', clearProps: 'opacity' },
          )
          return
        }

        gsap.fromTo(
          node,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.38,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            scrollTrigger: {
              trigger: node,
              start: 'top 93%',
              once: true,
            },
          },
        )
      })
    }, root)

    return () => ctx.revert()
  }, [containerRef, reducedMotion, selector])
}

/**
 * Smoothly count up real/verified numeric values using GSAP without inventing data.
 */
export function useAnimatedNumber(
  target: number | null,
  decimals = 0,
  reducedMotion = false,
): string {
  const [display, setDisplay] = useState<string>(() =>
    target !== null ? target.toFixed(decimals) : '—',
  )
  const prevRef = useRef<number>(target ?? 0)

  useEffect(() => {
    if (target === null) {
      Promise.resolve().then(() => setDisplay('—'))
      return
    }
    if (reducedMotion) {
      prevRef.current = target
      Promise.resolve().then(() => setDisplay(target.toFixed(decimals)))
      return
    }

    const proxy = { value: prevRef.current }
    const tween = gsap.to(proxy, {
      value: target,
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => {
        setDisplay(proxy.value.toFixed(decimals))
      },
      onComplete: () => {
        prevRef.current = target
        setDisplay(target.toFixed(decimals))
      },
    })

    return () => {
      tween.kill()
    }
  }, [decimals, reducedMotion, target])

  return display
}
