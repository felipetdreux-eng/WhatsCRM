import './pipelineDragScroll.css';

const DEFAULT_EDGE_SIZE = 96;
const DEFAULT_MAX_SPEED = 26;

export function getPipelineAutoScrollSpeed({ pointerX, left, right, edgeSize = DEFAULT_EDGE_SIZE, maxSpeed = DEFAULT_MAX_SPEED }) {
  const width = Math.max(1, right - left);
  const edge = Math.min(Math.max(24, edgeSize), width / 2);

  if (pointerX < left + edge) {
    const intensity = Math.min(1, Math.max(0, (left + edge - pointerX) / edge));
    return -Math.max(3, Math.round(maxSpeed * intensity));
  }

  if (pointerX > right - edge) {
    const intensity = Math.min(1, Math.max(0, (pointerX - (right - edge)) / edge));
    return Math.max(3, Math.round(maxSpeed * intensity));
  }

  return 0;
}

function installPipelineDragScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__fuplyPipelineDragScrollInstalled) return;
  window.__fuplyPipelineDragScrollInstalled = true;

  let activeScroll = null;
  let pointerX = null;
  let frame = null;
  let draggingPipelineCard = false;

  const clearDirectionClasses = () => {
    activeScroll?.classList.remove('pipeline-auto-scroll-left', 'pipeline-auto-scroll-right');
  };

  const stopFrame = () => {
    if (frame != null) cancelAnimationFrame(frame);
    frame = null;
  };

  const stop = () => {
    stopFrame();
    clearDirectionClasses();
    activeScroll = null;
    pointerX = null;
    draggingPipelineCard = false;
    document.body.classList.remove('pipeline-card-dragging');
  };

  const updateDirectionClass = speed => {
    if (!activeScroll) return;
    activeScroll.classList.toggle('pipeline-auto-scroll-left', speed < 0);
    activeScroll.classList.toggle('pipeline-auto-scroll-right', speed > 0);
  };

  const tick = () => {
    frame = null;
    if (!draggingPipelineCard || !activeScroll || pointerX == null) return;

    const rect = activeScroll.getBoundingClientRect();
    const speed = getPipelineAutoScrollSpeed({ pointerX, left: rect.left, right: rect.right });
    updateDirectionClass(speed);

    if (!speed) return;

    const before = activeScroll.scrollLeft;
    activeScroll.scrollLeft += speed;
    const moved = activeScroll.scrollLeft !== before;

    if (moved) frame = requestAnimationFrame(tick);
  };

  const scheduleTick = () => {
    if (frame == null) frame = requestAnimationFrame(tick);
  };

  document.addEventListener('dragstart', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('.pipeline-scroll .lead-card[draggable="true"]')) return;
    draggingPipelineCard = true;
    document.body.classList.add('pipeline-card-dragging');
  }, true);

  document.addEventListener('dragover', event => {
    if (!draggingPipelineCard) return;
    const target = event.target instanceof Element ? event.target : null;
    const scroll = target?.closest('.pipeline-scroll');
    if (!scroll) {
      clearDirectionClasses();
      stopFrame();
      activeScroll = null;
      pointerX = null;
      return;
    }

    if (activeScroll !== scroll) {
      clearDirectionClasses();
      activeScroll = scroll;
    }

    pointerX = event.clientX;
    const rect = scroll.getBoundingClientRect();
    const speed = getPipelineAutoScrollSpeed({ pointerX, left: rect.left, right: rect.right });
    updateDirectionClass(speed);

    if (speed) scheduleTick();
    else stopFrame();
  }, true);

  document.addEventListener('drop', stop, true);
  document.addEventListener('dragend', stop, true);
  window.addEventListener('blur', stop);
}

installPipelineDragScroll();
