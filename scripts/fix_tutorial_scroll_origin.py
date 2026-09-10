from pathlib import Path

p = Path('src/Tutorial.jsx')
text = p.read_text()

old_rect = """function rectChanged(previous, next) {
  if (!previous || !next) return true;
  return ['left', 'top', 'width', 'height'].some(key => Math.abs(previous[key] - next[key]) > 0.5);
}
"""
new_rect = """function rectChanged(previous, next) {
  if (!previous || !next) return true;
  return ['left', 'top', 'width', 'height'].some(key => Math.abs(previous[key] - next[key]) > 0.5);
}

function resetDocumentScroll() {
  const scrollingElement = document.scrollingElement || document.documentElement;
  if (scrollingElement) {
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
"""
if old_rect not in text:
    raise SystemExit('rectChanged block not found')
text = text.replace(old_rect, new_rect, 1)

old_nav = """  const navigateTo = page => {
    const button = navButton(page);
    if (button && !button.classList.contains('active')) {
      button.click();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  };
"""
new_nav = """  const navigateTo = page => {
    resetDocumentScroll();
    const button = navButton(page);
    if (button && !button.classList.contains('active')) button.click();
    resetDocumentScroll();
  };
"""
if old_nav not in text:
    raise SystemExit('navigateTo block not found')
text = text.replace(old_nav, new_nav, 1)

old_start = """    const startTutorial = () => {
      setStepIndex(0);
      setRect(null);
      setOpen(true);
    };
"""
new_start = """    const startTutorial = () => {
      resetDocumentScroll();
      targetRef.current = null;
      setStepIndex(0);
      setRect(null);
      setOpen(true);
      window.requestAnimationFrame(resetDocumentScroll);
    };
"""
if old_start not in text:
    raise SystemExit('startTutorial block not found')
text = text.replace(old_start, new_start, 1)

old_vars = """    let animationFrame = null;
    let resizeObserver = null;
"""
new_vars = """    let animationFrame = null;
    let settleFrameOne = null;
    let settleFrameTwo = null;
    let resizeObserver = null;
"""
if old_vars not in text:
    raise SystemExit('animation vars block not found')
text = text.replace(old_vars, new_vars, 1)

old_attach = """      targetRef.current = target;
      const targetRect = target.getBoundingClientRect();
      const isVisible = targetRect.bottom > 72 && targetRect.top < window.innerHeight - 36;
      if (!isVisible) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
      scheduleUpdate();

      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(scheduleUpdate);
        resizeObserver.observe(target);
      }
"""
new_attach = """      const targetRect = target.getBoundingClientRect();
      const isVisible = targetRect.bottom > 72 && targetRect.top < window.innerHeight - 36;
      if (!isVisible) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }

      settleFrameOne = window.requestAnimationFrame(() => {
        settleFrameOne = null;
        settleFrameTwo = window.requestAnimationFrame(() => {
          settleFrameTwo = null;
          if (cancelled || !target.isConnected) return;
          targetRef.current = target;
          updateRect();

          if ('ResizeObserver' in window) {
            resizeObserver = new ResizeObserver(scheduleUpdate);
            resizeObserver.observe(target);
          }
        });
      });
"""
if old_attach not in text:
    raise SystemExit('attach target block not found')
text = text.replace(old_attach, new_attach, 1)

old_cleanup = """      if (animationFrame != null) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
"""
new_cleanup = """      if (animationFrame != null) window.cancelAnimationFrame(animationFrame);
      if (settleFrameOne != null) window.cancelAnimationFrame(settleFrameOne);
      if (settleFrameTwo != null) window.cancelAnimationFrame(settleFrameTwo);
      resizeObserver?.disconnect();
"""
if old_cleanup not in text:
    raise SystemExit('cleanup block not found')
text = text.replace(old_cleanup, new_cleanup, 1)

p.write_text(text)
