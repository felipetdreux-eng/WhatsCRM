import React, { useEffect, useState } from 'react';
import LeadsPage from './LeadsPage';
import LeadDeletionManager from './LeadDeletionManager';
import { getActiveAccount } from './accountStorage';
import { loadWorkspaceContext } from './backendBridge';
import './leads-integrated.css';

export default function FollowUps(props) {
  const account = getActiveAccount();
  const [memberNames, setMemberNames] = useState({});

  useEffect(() => {
    let active = true;
    if (props.demoMode || !account?.id) return undefined;

    loadWorkspaceContext(account.id)
      .then(context => {
        if (!active) return;
        const names = Object.fromEntries((context?.members || []).map(member => [member.user_id, member.name]));
        if (account?.id && account?.name) names[account.id] = names[account.id] || account.name;
        setMemberNames(names);
      })
      .catch(error => console.error('Lead assignee names load failed:', error));

    return () => { active = false; };
  }, [account?.id, account?.name, props.demoMode]);

  const memberName = userId => {
    if (!userId) return 'Sem responsável';
    return memberNames[userId] || (userId === account?.id ? account?.name || 'Você' : 'Responsável');
  };

  return (
    <>
      <LeadsPage {...props} memberName={memberName} />
      <LeadDeletionManager leads={props.leads} setLeads={props.setLeads} demoMode={props.demoMode} />
    </>
  );
}
