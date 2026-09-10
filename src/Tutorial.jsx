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
    text: 'Comece com nome e WhatsApp. Depois você pode definir empresa, valor, origem, responsável, observações e o próximo contato.',
  },
  {
    page: 'Leads',
    selector: '.leads-import-button',
    title: 'Já tem contatos? Importe sua planilha',
    text: 'Use Importar planilha para trazer seus contatos de CSV, Excel ou PDF e revisar tudo antes de confirmar. No computador, você também pode arrastar o arquivo para o Fuply e soltar para começar a importação.',
  },
  {
    page: 'Leads',
    selector: '.leads-directory',
    title: 'Organize e atualize seus leads',
    text: 'Aqui fica sua base de contatos. Abra um lead para editar as informações, mudar o status, definir o responsável e acompanhar tudo que já aconteceu na negociação.',
  },
  {
    page: 'Leads',
    selector: '.leads-summary',
    title: 'Marque quem precisa de retorno',
    text: 'Use “Marcar para” em cada lead para escolher Hoje, Amanhã, +3 dias, +7 dias ou uma data personalizada. Depois, use os filtros para encontrar atrasados, contatos de hoje, próximos 7 dias e leads sem próximo contato.',
  },
  {
    page: 'Pipeline',
    selector: '.pipeline-board .pipeline-column',
    title: 'Acompanhe cada negociação no Pipeline',
    text: 'Cada coluna representa uma etapa da venda. Conforme a conversa avança, mova o lead entre as etapas até Fechado ou Perdido e filtre por responsável quando estiver trabalhando em equipe.',
  },
  {
    page: 'Mensagens',
    selector: '.messages-controls',
    title: 'Use mensagens prontas no WhatsApp',
    text: 'Escolha um lead e o Fuply personaliza os modelos com nome, empresa e valor. Você também tem mensagens para primeiro contato, follow-up, proposta, última tentativa e para pedir atendimento de uma pessoa responsável.',
  },
  {
    page: 'Dashboard',
    selector: '.autopilot-dashboard',
    title: 'Deixe o Autopilot montar sua fila de vendas',
    text: 'O Autopilot analisa seus leads e ordena quem merece atenção primeiro usando atraso, etapa da negociação, valor e tempo sem interação. Abra a fila e avance pelas oportunidades sem precisar decidir manualmente por onde começar.',
  },
  {
    page: 'Dashboard',
    selector: '.team-metrics-grid',
    title: 'Acompanhe o desempenho da equipe',
    text: 'Veja leads, vendas, conversão, faturamento e follow-ups por responsável. Use o filtro para comparar a equipe inteira ou analisar cada membro separadamente.',
  },
  {
    page: 'Configurações',
    selector: '.team-heading',
    title: 'Trabalhe com sua equipe sem dividir senha',
    text: 'Em Configurações → Equipe, gere um código de convite para novos membros ou entre em outro workspace. Cada pessoa usa a própria conta, mas todos compartilham os leads, o Pipeline e o histórico da equipe.',
  },
  {
    page: 'Dashboard',
    selector: '.focus-tabs',
    title: 'Comece o dia pelas prioridades',
    text: 'O Dashboard coloca atrasados, contatos de hoje, leads sem próximo passo e negociações esfriando na sua frente. Assim você abre o Fuply e já sabe o que precisa fazer primeiro.',
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
    if (goal === 'followups') return 'Como seu foco é follow-up, preste atenção especialmente em Marcar para, Autopilot e nas prioridades do Dashboard.';
    if (goal === 'sales') return 'Como seu foco é vender mais, Pipeline, Mensagens, Autopilot e Dashboard da equipe vão ser suas telas principais.';
    if (goal === 'organize') return 'Como seu foco é organização, Importar planilha, Leads, responsáveis, marcações e Pipeline vão concentrar quase todo o seu trabalho.';
    return '';
  }, [goal]);

  const navigateTo = page => {
    const button = navButton(page);
    if (button && !button.classList.contains('active')) {
      button.click();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
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
  const pad = 6;
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

  return (
    <div className="tutorial-layer" aria-live="polite">
      {spotlight ? <div className="tutorial-spotlight" style={spotlight} /> : <div className="tutorial-backdrop" />}
      <section
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
        <div className="tutorial-step-copy" key={stepIndex}>
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
