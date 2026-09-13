import React from 'react';
import LeadsPage from './LeadsPage';
import LeadDeletionManager from './LeadDeletionManager';
import './leads-integrated.css';

export default function FollowUps(props) {
  return (
    <>
      <LeadsPage {...props} />
      <LeadDeletionManager leads={props.leads} setLeads={props.setLeads} demoMode={props.demoMode} />
    </>
  );
}
