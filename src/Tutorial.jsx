import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabaseClient';
import './tutorial.css';

const STEPS = [
  {
    page: 'Dashboard',
    selector: '.dashboard-header-actions .primary-button',
    title: 'Adicione seu primeiro lead',
    text: 'Nome e WhatsApp já bastam para começar. Depois você pode adicionar valor, origem e o próximo contato.',
  },
  {
    page: 'Leads',
    selector: '.leads-import-button',
    title: 'Já tem uma planilha? Traga tudo de uma vez',
    text: 'Use Importar planilha para trazer CSV, Excel ou PDF e revisar os contatos antes de confirmar. No computador, você também pode arrastar o arquivo e soltar em qualquer lugar do Fuply.',
  },
  {
    page: 'Pipeline',
    selector: '.pipeline-scroll',
    title: 'Acompanhe a negociação no Pipeline',
    text: 'Cada coluna representa uma etapa. Conforme a conversa avança, mova o lead até Fechado ou Perdido.',
  },
  {
    page: 'Leads',
    selector: '.leads-summary',
    title: 'Nunca esqueça um follow-up',
    text: 'Aqui aparecem atrasados, contatos de hoje e leads sem próximo passo. Reagende, conclua o retorno ou abra o WhatsApp em poucos cliques.',
  },
  {
    page: 'Mensagens',
    selector: '.messages-controls',
    title: 'Use mensagens prontas sem parecer um robô',
    text: 'Escolha um lead e o sistema preenche nome, empresa e valor nos seus modelos antes de abrir a conversa no WhatsApp.',
  },
  {
    page: 'Dashboard',
    selector: '.focus-shell',
    title: 'Comece o dia por aqui',
    text: 'O Dashboard coloca primeiro quem está atrasado, quem precisa de resposta e quem ainda não tem próximo contato marcado.',
  },
];

function navButton(label) {
  return [...document.querySelectorAll('.nav-item')].find(button => button.textContent?.trim().startsWith(label));
}

function findTarget(currentStep) {
  if (!currentStep?.selector) return null;
  return document.querySelector(currentStep.selector);
}

function rectChanged(previous, next) {
  if (!previous || !next) return true;
  return ['left', 'top', 'width', 'height'].some(key => Math.abs(previous[key] - next[key]) > 0.5);
}

function Tutorial() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [userId, setUserId] = useState(null);
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const targetRef = useRef(null);
  const step = STEPS[stepIndex];

  const goalHint = useMemo(() => {
    if (goal === 'followups') return 'Como seu foco é follow-up, preste atenção especialmente aos passos 4 e 6.';
    if (goal === 'sales') return 'Como seu foco é vender mais, Pipeline e Dashboard vão ser suas telas principais.';
    if (goal === 'organize') return 'Como seu foco é organização, importação, Pipeline e Leads vão concentrar quase todo o seu trabalho.';
    return '';
  }, [goal]);

  const navigateTo = page => {
    const button = navButton(page);
    if (button && !button.classList.contains('active')) button.click();
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!active || !user) return;
      setUserId(user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed,tutorial_completed,goal')
        .eq('id', user.id)
        .single();
      if (!active || error) return;
      setGoal(data?.goal || '');
      if (data?.onboarding_completed && !data?.tutorial_completed) {
        window.setTimeout(() => {
          if (active) {
            setStepIndex(0);
            setOpen(true);
          }
        }, 700);
      }
    };

    bootstrap();
    const startTutorial = () => {
      setStepIndex(0);
      setRect(null);
      setOpen(true);
    };
    window.addEventListener('zapflow:start-tutorial', startTutorial);
    return () => {
      active = false;
      window.removeEventListener('zapflow:start-tutorial', startTutorial);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      targetRef.current = null;
      setRect(null);
      return undefined;
    }

    let cancelled = false;
    let retryTimer = null;
    let startTimer = null;
    let animationFrame = null;
    let resizeObserver = null;
    setRect(null);
    targetRef.current = null;
    navigateTo(step.page);

    const updateRect = () => {
      const target = targetRef.current;
      if (!target?.isConnected) return;
      const nextRect = target.getBoundingClientRect();
      setRect(previous => rectChanged(previous, nextRect) ? nextRect : previous);
    };

    const scheduleUpdate = () => {
      if (animationFrame != null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateRect();
      });
    };

    const attachTarget = (attempt = 0) => {
      if (cancelled) return;
      const target = findTarget(step);
      if (!target) {
        if (attempt < 30) retryTimer = window.setTimeout(() => attachTarget(attempt + 1), 70);
        return;
      }

      targetRef.current = target;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
      scheduleUpdate();

      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(scheduleUpdate);
        resizeObserver.observe(target);
      }
    };

    startTimer = window.setTimeout(() => attachTarget(), 60);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);

    return () => {
      cancelled = true;
      targetRef.current = null;
      if (startTimer) window.clearTimeout(startTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (animationFrame != null) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndRemember();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, userId]);

  const closeAndRemember = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (userId) {
        const { error } = await supabase.from('profiles').update({ tutorial_completed: true }).eq('id', userId);
        if (error) console.error('Tutorial completion save failed:', error);
      }
    } finally {
      setSaving(false);
      setOpen(false);
      navigateTo('Dashboard');
    }
  };

  const next = () => {
    if (stepIndex >= STEPS.length - 1) {
      closeAndRemember();
      return;
    }
    setRect(null);
    setStepIndex(value => value + 1);
  };

  const previous = () => {
    if (stepIndex === 0) return;
    setRect(null);
    setStepIndex(value => value - 1);
  };

  if (!open) return null;

  const isMobile = window.innerWidth < 720;
  const pad = 7;
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

  return (
    <div className="tutorial-layer" aria-live="polite">
      {spotlight ? <div className="tutorial-spotlight" style={spotlight} /> : <div className="tutorial-backdrop" />}
      <section
        key={stepIndex}
        className={`tutorial-card ${rect ? 'is-ready' : 'is-locating'}`}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        aria-label={`Tutorial, passo ${stepIndex + 1} de ${STEPS.length}`}
      >
        <div className="tutorial-card-top">
          <span>Passo {stepIndex + 1} de {STEPS.length}</span>
          <button type="button" onClick={closeAndRemember} disabled={saving} aria-label="Pular tutorial"><X size={17} /></button>
        </div>
        <div className="tutorial-progress" aria-hidden="true">
          {STEPS.map((_, index) => <span key={index} className={index <= stepIndex ? 'active' : ''} />)}
        </div>
        <div className="tutorial-step-copy">
          <h2 id="tutorial-title">{step.title}</h2>
          <p>{step.text}</p>
          {stepIndex === 0 && goalHint && <div className="tutorial-hint">{goalHint}</div>}
        </div>
        <footer className="tutorial-actions">
          <button type="button" className="tutorial-skip" onClick={closeAndRemember} disabled={saving}>Pular tutorial</button>
          <div>
            {stepIndex > 0 && <button type="button" className="tutorial-back" onClick={previous}><ArrowLeft size={15} /> Voltar</button>}
            <button type="button" className="tutorial-next" onClick={next} disabled={saving}>
              {stepIndex === STEPS.length - 1 ? <><Check size={15} /> {saving ? 'Salvando...' : 'Concluir'}</> : <>Continuar <ArrowRight size={15} /></>}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

const host = document.getElementById('tutorial-root');
if (host) createRoot(host).render(<Tutorial />);
