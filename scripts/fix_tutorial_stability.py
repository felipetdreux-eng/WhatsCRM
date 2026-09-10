from pathlib import Path

jsx_path = Path('src/Tutorial.jsx')
css_path = Path('src/tutorial.css')
text = jsx_path.read_text()
css = css_path.read_text()

# Use compact, meaningful targets instead of outlining huge page containers.
text = text.replace("selector: '.pipeline-scroll',", "selector: '.pipeline-board .pipeline-column',")
text = text.replace("selector: '.team-dashboard',", "selector: '.team-metrics-grid',")
text = text.replace("selector: '.team-card',", "selector: '.team-heading',")
text = text.replace("selector: '.focus-shell',", "selector: '.focus-tabs',")

old_spotlight = """  const pad = 7;
  const spotlight = rect ? {
    left: Math.max(6, rect.left - pad),
    top: Math.max(6, rect.top - pad),
    width: Math.min(window.innerWidth - 12, Math.max(0, rect.width + pad * 2)),
    height: Math.min(window.innerHeight - 12, Math.max(0, rect.height + pad * 2)),
  } : null;

  let cardStyle = {};
  if (isMobile) {
    cardStyle = { left: 14, right: 14, bottom: 14, top: 'auto', width: 'auto' };
  } else if (rect) {
    const width = 380;
    const gap = 18;
    const targetCenter = rect.left + rect.width / 2;
    const left = targetCenter >= window.innerWidth / 2
      ? gap
      : Math.max(gap, window.innerWidth - width - gap);
    cardStyle = {
      width,
      left,
      top: 18,
    };
  } else {
    cardStyle = { width: 380, left: '50%', top: 18, transform: 'translateX(-50%)' };
  }
"""
new_spotlight = """  const pad = 6;
  const spotlight = rect ? (() => {
    const left = Math.max(8, rect.left - pad);
    const top = Math.max(8, rect.top - pad);
    const right = Math.min(window.innerWidth - 8, rect.right + pad);
    const bottom = Math.min(window.innerHeight - 8, rect.bottom + pad);
    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  })() : null;

  const cardStyle = isMobile
    ? { left: 14, right: 14, bottom: 14, top: 'auto', width: 'auto' }
    : { width: 380, left: '50%', top: 18, transform: 'translateX(-50%)' };
"""
if old_spotlight not in text:
    raise SystemExit('spotlight/card positioning block not found')
text = text.replace(old_spotlight, new_spotlight, 1)

# Keep the card mounted between steps so it cannot jump/re-enter during navigation.
text = text.replace('        key={stepIndex}\n        className={`tutorial-card ${rect ? \'is-ready\' : \'is-locating\'}`}', '        className={`tutorial-card ${rect ? \'is-ready\' : \'is-locating\'}`}')
text = text.replace('<div className="tutorial-step-copy">', '<div className="tutorial-step-copy" key={stepIndex}>', 1)

old_css = '.tutorial-spotlight{position:fixed;border:2px solid #5ed19a;border-radius:14px;box-shadow:0 0 0 9999px rgba(15,23,42,.62),0 0 0 4px rgba(94,209,154,.18);pointer-events:none;will-change:left,top,width,height;animation:tutorial-spotlight-in .18s ease-out both}.tutorial-spotlight::after{content:"";position:absolute;inset:-5px;border:1px solid rgba(94,209,154,.62);border-radius:18px;pointer-events:none;animation:tutorial-pulse 1.8s ease-out infinite}'
new_css = '.tutorial-spotlight{position:fixed;border:2px solid #16a36a;border-radius:12px;box-shadow:0 0 0 9999px rgba(15,23,42,.58),0 8px 24px rgba(15,23,42,.14);pointer-events:none;will-change:left,top,width,height;animation:tutorial-spotlight-in .12s ease-out both}.tutorial-spotlight::after{content:"";position:absolute;inset:-3px;border:1px solid rgba(22,163,106,.22);border-radius:14px;pointer-events:none}'
if old_css not in css:
    raise SystemExit('spotlight css block not found')
css = css.replace(old_css, new_css, 1)

# Remove pulse from reduced-motion selector and keep the card itself from re-animating each step.
css = css.replace('.tutorial-layer,.tutorial-backdrop,.tutorial-spotlight,.tutorial-spotlight::after,.tutorial-card,.tutorial-step-copy,.tutorial-hint{animation:none}', '.tutorial-layer,.tutorial-backdrop,.tutorial-spotlight,.tutorial-card,.tutorial-step-copy,.tutorial-hint{animation:none}')

jsx_path.write_text(text)
css_path.write_text(css)
