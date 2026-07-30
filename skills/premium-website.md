---
name: premium-website
description: Apple/Stripe/Linear-tier single-page websites
triggers: website, landing page, landing-page, portfolio, web page, webpage, homepage
---
Build premium single-file websites (one index.html with embedded CSS/JS, no build step, no CDN deps except Google Fonts).

DESIGN TOKENS — always define CSS variables first:
- Dark theme default: bg #0a0a0f, surface rgba(255,255,255,0.04), text #f5f5f7, muted #86868b, one accent color max (electric blue #4f7cff, or match the brand).
- Font: 'Inter' (Google Fonts) with system-ui fallback. Weights 400/500/700 only.
- Type scale: hero clamp(2.8rem, 7vw, 5.5rem) weight 700 letter-spacing -0.03em; section titles clamp(1.8rem, 4vw, 3rem); body 1.06rem line-height 1.7 color muted.
- Spacing: sections padding 120px 24px; max-width 1100px centered; grid gap 24px. Generous whitespace is the #1 premium signal.

STRUCTURE (in order): sticky glass nav (backdrop-filter: blur(20px), border-bottom 1px rgba(255,255,255,0.08)) → hero (badge pill, huge headline with a gradient word, subline, two CTAs) → social proof / logo row → 3-6 feature cards → showcase/screenshot section → pricing (middle tier highlighted, scale(1.05)) → big final CTA → minimal footer.

DETAILS THAT SELL IT:
- Gradient text: background:linear-gradient(135deg,#fff,var(--accent)); -webkit-background-clip:text; color:transparent.
- Cards: surface bg, 1px rgba(255,255,255,0.08) border, border-radius 16-20px, hover translateY(-4px) + border-color accent, transition 0.3s cubic-bezier(0.22,1,0.36,1).
- Scroll reveal: IntersectionObserver adds .visible → opacity 0→1, translateY(24px)→0, stagger with transition-delay.
- Subtle bg atmosphere: 1-2 huge blurred radial-gradient blobs (position fixed, filter blur(120px), opacity 0.15, accent color).
- Buttons: primary = accent bg, radius 12px, padding 14px 28px, weight 500, hover brightness(1.1) translateY(-1px); secondary = transparent with border.
- Responsive: grid-template-columns repeat(auto-fit,minmax(280px,1fr)); nav links hide under 700px.

NEVER: Bootstrap look, cheap purple-pink gradients on everything, tiny cramped padding, more than 2 fonts, default blue links, lorem ipsum (write real copy for the product).
