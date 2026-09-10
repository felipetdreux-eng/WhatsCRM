from pathlib import Path

p = Path('src/Tutorial.jsx')
text = p.read_text()

old_nav = """  const navigateTo = page => {
    const button = navButton(page);
    if (button && !button.classList.contains('active')) button.click();
  };
"""
new_nav = """  const navigateTo = page => {
    const button = navButton(page);
    if (button && !button.classList.contains('active')) {
      button.click();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  };
"""
if old_nav not in text:
    raise SystemExit('navigateTo block not found')
text = text.replace(old_nav, new_nav, 1)

old_scroll = """      targetRef.current = target;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
      scheduleUpdate();
"""
new_scroll = """      targetRef.current = target;
      const targetRect = target.getBoundingClientRect();
      const isVisible = targetRect.bottom > 72 && targetRect.top < window.innerHeight - 36;
      if (!isVisible) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
      scheduleUpdate();
"""
if old_scroll not in text:
    raise SystemExit('scrollIntoView block not found')
text = text.replace(old_scroll, new_scroll, 1)

old_card = """  } else if (rect) {
    const width = 380;
    const left = Math.min(window.innerWidth - width - 18, Math.max(18, rect.left + rect.width / 2 - width / 2));
    const cardHeightEstimate = 250;
    const roomBelow = window.innerHeight - rect.bottom;
    const roomAbove = rect.top;
    const placeBelow = roomBelow >= cardHeightEstimate + 28 || roomBelow >= roomAbove;
    cardStyle = {
      width,
      left,
      top: placeBelow
        ? Math.min(window.innerHeight - cardHeightEstimate - 18, rect.bottom + 18)
        : Math.max(18, rect.top - cardHeightEstimate - 18),
    };
  } else {
    cardStyle = { width: 380, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }
"""
new_card = """  } else if (rect) {
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
if old_card not in text:
    raise SystemExit('desktop card positioning block not found')
text = text.replace(old_card, new_card, 1)

p.write_text(text)
