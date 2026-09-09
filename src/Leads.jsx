import React, { useEffect, useState } from 'react';
import FollowUps from './FollowUps';

export default function Leads({ leads, openLead, openWhatsApp }) {
  const [sharedLeads, setSharedLeads] = useState(leads);

  useEffect(() => {
    setSharedLeads(leads);
  }, [leads]);

  const updateSharedLeads = updater => {
    setSharedLeads(current => {
      const next = typeof updater === 'function' ? updater(current) : updater;

      // Mantém a mesma base em memória usada pelo restante do MVP e persiste no navegador.
      if (Array.isArray(leads) && Array.isArray(next)) {
        leads.splice(0, leads.length, ...next);
      }
      localStorage.setItem('zapflow-leads', JSON.stringify(next));
      return next;
    });
  };

  return (
    <FollowUps
      leads={sharedLeads}
      setLeads={updateSharedLeads}
      openLead={openLead}
      openWhatsApp={openWhatsApp}
    />
  );
}
