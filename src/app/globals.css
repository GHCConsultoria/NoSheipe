@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-paper: #0a0b0d;
  --color-paper-raised: #131519;
  --color-ink: #e6e8eb;
  --color-ink-soft: #8b929b;
  --color-ink-faint: #52585f;
  --color-rule: #22262c;

  --color-urgent: #ff6b7a;
  --color-urgent-bg: #2a1319;
  --color-urgent-line: #ff6b7a;

  --color-attention: #ffc145;
  --color-attention-bg: #2a2011;
  --color-attention-line: #ffc145;

  --color-calm: #3ddc97;
  --color-calm-bg: #0f241c;
  --color-calm-line: #3ddc97;

  --color-sheipe: #22c55e;
  --color-sheipe-deep: #4ade80;
  --color-on-sheipe: #04150a;

  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 40px -16px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.03);

  --grid-line: rgba(255, 255, 255, 0.035);
  --scanline: rgba(255, 255, 255, 0.018);

  /* Fixas — não trocam com o tema. Painel de assinatura (login) fica sempre
     no mesmo tom, mesmo se o resto virar claro. */
  --signature-ink: #000000;
  --signature-paper: #e6e8eb;
  --signature-sheipe: #22c55e;
}

@media (prefers-color-scheme: light) {
  :root {
    --color-paper: #eef0f3;
    --color-paper-raised: #ffffff;
    --color-ink: #101215;
    --color-ink-soft: #565c64;
    --color-ink-faint: #9199a1;
    --color-rule: #dce0e5;

    --color-urgent: #d6304a;
    --color-urgent-bg: #fce8ea;
    --color-urgent-line: #d6304a;

    --color-attention: #b7791f;
    --color-attention-bg: #fbf0dc;
    --color-attention-line: #b7791f;

    --color-calm: #0f9d64;
    --color-calm-bg: #e1f5ea;
    --color-calm-line: #0f9d64;

    --color-sheipe: #16a34a;
    --color-sheipe-deep: #15803d;
    --color-on-sheipe: #f0fdf4;

    --shadow-card: 0 1px 2px rgba(16, 18, 21, 0.04), 0 8px 24px -12px rgba(16, 18, 21, 0.12);

    --grid-line: rgba(16, 18, 21, 0.045);
    --scanline: rgba(16, 18, 21, 0.02);
  }
}

/*
 * Override explícito de tema: o botão de alternância seta data-theme na tag
 * <html>, o que precisa VENCER a media query acima em qualquer direção — por
 * isso os dois blocos abaixo duplicam os valores dos blocos correspondentes
 * (:root e a media query light). Sem data-theme setado, o tema segue
 * prefers-color-scheme como sempre.
 */
:root[data-theme="dark"] {
  --color-paper: #0a0b0d;
  --color-paper-raised: #131519;
  --color-ink: #e6e8eb;
  --color-ink-soft: #8b929b;
  --color-ink-faint: #52585f;
  --color-rule: #22262c;
  --color-urgent: #ff6b7a;
  --color-urgent-bg: #2a1319;
  --color-urgent-line: #ff6b7a;
  --color-attention: #ffc145;
  --color-attention-bg: #2a2011;
  --color-attention-line: #ffc145;
  --color-calm: #3ddc97;
  --color-calm-bg: #0f241c;
  --color-calm-line: #3ddc97;
  --color-sheipe: #22c55e;
  --color-sheipe-deep: #4ade80;
  --color-on-sheipe: #04150a;
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 40px -16px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.03);
  --grid-line: rgba(255, 255, 255, 0.035);
  --scanline: rgba(255, 255, 255, 0.018);
}

:root[data-theme="light"] {
  --color-paper: #eef0f3;
  --color-paper-raised: #ffffff;
  --color-ink: #101215;
  --color-ink-soft: #565c64;
  --color-ink-faint: #9199a1;
  --color-rule: #dce0e5;
  --color-urgent: #d6304a;
  --color-urgent-bg: #fce8ea;
  --color-urgent-line: #d6304a;
  --color-attention: #b7791f;
  --color-attention-bg: #fbf0dc;
  --color-attention-line: #b7791f;
  --color-calm: #0f9d64;
  --color-calm-bg: #e1f5ea;
  --color-calm-line: #0f9d64;
  --color-sheipe: #16a34a;
  --color-sheipe-deep: #15803d;
  --color-on-sheipe: #f0fdf4;
  --shadow-card: 0 1px 2px rgba(16, 18, 21, 0.04), 0 8px 24px -12px rgba(16, 18, 21, 0.12);
  --grid-line: rgba(16, 18, 21, 0.045);
  --scanline: rgba(16, 18, 21, 0.02);
}

* {
  border-color: var(--color-rule);
}

html {
  color-scheme: dark light;
}

body {
  color: var(--color-ink);
  background: var(--color-paper);
  font-family: var(--font-body), ui-sans-serif, system-ui, sans-serif;
  position: relative;
  min-height: 100vh;
}

/* Grade + scanlines sutis — sensação de painel/app, não tela lisa. */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(0deg, var(--scanline) 0px, var(--scanline) 1px, transparent 1px, transparent 3px),
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 100% 3px, 56px 56px, 56px 56px;
}

#__next,
body > div {
  position: relative;
  z-index: 1;
}

::selection {
  background: var(--color-sheipe);
  color: var(--color-on-sheipe);
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }

  .eyebrow {
    font-family: var(--font-data), ui-monospace, monospace;
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  .rule {
    border-top: 1px solid var(--color-rule);
  }

  .paper-card {
    background: var(--color-paper-raised);
    border: 1px solid var(--color-rule);
    box-shadow: var(--shadow-card);
  }

  .expand {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 360ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .expand.is-open {
    grid-template-rows: 1fr;
  }
  .expand > div {
    overflow: hidden;
  }

  .stagger-in {
    animation: fade-up 560ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
    animation-delay: calc(var(--stagger-index, 0) * 90ms);
  }
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stagger-in {
    animation: none;
  }
  .expand {
    transition: none;
  }
}
