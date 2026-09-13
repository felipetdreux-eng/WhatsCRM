from pathlib import Path

path = Path('src/backendBridge.js')
text = path.read_text()
old = """      const channel = supabase
        .channel(`workspace-leads-${workspaceId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `workspace_id=eq.${workspaceId}` }, payload => {
          const actorId = payload?.new?.last_modified_by || payload?.old?.last_modified_by || null;
          if (actorId && actorId === userId) return;
          window.clearTimeout(window.__zapflowRemoteRefreshTimer);
          window.__zapflowRemoteRefreshTimer = window.setTimeout(async () => {
            try {
              const freshLeads = await loadLeads(userId);
              lastSnapshot = new Map(freshLeads.map(lead => [lead.id, leadFingerprint(lead)]));
              originalSetItem.call(localStorage, 'zapflow-leads', JSON.stringify(freshLeads));
              window.dispatchEvent(new CustomEvent('zapflow:remote-leads', { detail: { leads: freshLeads } }));
            } catch (error) {
              console.error('Workspace realtime refresh failed:', error);
            }
          }, 120);
        })
        .subscribe();
"""
new = """      const refreshWorkspace = payload => {
        const actorId = payload?.new?.last_modified_by || null;
        if (payload?.eventType !== 'DELETE' && actorId && actorId === userId) return;
        window.clearTimeout(window.__zapflowRemoteRefreshTimer);
        window.__zapflowRemoteRefreshTimer = window.setTimeout(async () => {
          try {
            const freshLeads = await loadLeads(userId);
            lastSnapshot = new Map(freshLeads.map(lead => [lead.id, leadFingerprint(lead)]));
            originalSetItem.call(localStorage, 'zapflow-leads', JSON.stringify(freshLeads));
            window.dispatchEvent(new CustomEvent('zapflow:remote-leads', { detail: { leads: freshLeads } }));
          } catch (error) {
            console.error('Workspace realtime refresh failed:', error);
          }
        }, 120);
      };

      const workspaceFilter = `workspace_id=eq.${workspaceId}`;
      const channel = supabase
        .channel(`workspace-leads-${workspaceId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: workspaceFilter }, refreshWorkspace)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: workspaceFilter }, refreshWorkspace)
        // Supabase Postgres Changes does not support filters on DELETE events.
        // Treat any delete as an invalidation signal, then re-fetch the current RLS-scoped workspace.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, refreshWorkspace)
        .subscribe();
"""
if old not in text:
    raise SystemExit('Realtime block not found')
path.write_text(text.replace(old, new, 1))
