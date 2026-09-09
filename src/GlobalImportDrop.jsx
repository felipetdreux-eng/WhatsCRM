import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import LeadImporter from './LeadImporter';
import { getActiveAccount } from './accountStorage';
import { recordLeadActivity, syncLeads } from './backendBridge';
import './global-import.css';

const FLASH_KEY = 'fuply-import-flash';

function readStoredLeads() {
  try {
    const parsed = JSON.parse(localStorage.getItem('zapflow-leads'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasFiles(event) {
  return Array.from(event?.dataTransfer?.types || []).includes('Files');
}

function importSummary(stats = {}) {
  const parts = [];
  if (stats.create) parts.push(`${stats.create} novo${stats.create === 1 ? '' : 's'}`);
  if (stats.update) parts.push(`${stats.update} atualizado${stats.update === 1 ? '' : 's'}`);
  if (stats.errors) parts.push(`${stats.errors} ignorado${stats.errors === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'nenhuma alteração';
}

export default function GlobalImportDrop() {
  const account = getActiveAccount();
  const dragDepth = useRef(0);
  const importerHostRef = useRef(null);
  const injectedFileRef = useRef('');
  const latestLeadsRef = useRef(readStoredLeads());
  const [leads, setLeadsState] = useState(latestLeadsRef.current);
  const [dragActive, setDragActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLASH_KEY);
      if (!raw) return undefined;
      sessionStorage.removeItem(FLASH_KEY);
      const stats = JSON.parse(raw);
      setToast(`Importação concluída: ${importSummary(stats)}.`);
      const timer = window.setTimeout(() => setToast(''), 4200);
      return () => window.clearTimeout(timer);
    } catch {
      sessionStorage.removeItem(FLASH_KEY);
      return undefined;
    }
  }, []);

  useEffect(() => {
    const resetDrag = () => {
      dragDepth.current = 0;
      setDragActive(false);
    };

    const onDragEnter = event => {
      if (open || !hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragActive(true);
    };

    const onDragOver = event => {
      if (open || !hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setDragActive(true);
    };

    const onDragLeave = event => {
      if (open || !hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    };

    const onDrop = event => {
      if (open || !hasFiles(event)) return;
      event.preventDefault();
      const droppedFile = event.dataTransfer?.files?.[0];
      resetDrag();
      if (!droppedFile) return;

      const currentLeads = readStoredLeads();
      latestLeadsRef.current = currentLeads;
      setLeadsState(currentLeads);
      injectedFileRef.current = '';
      setFile(droppedFile);
      setOpen(true);
    };

    window.addEventListener('dragenter', onDragEnter, true);
    window.addEventListener('dragover', onDragOver, true);
    window.addEventListener('dragleave', onDragLeave, true);
    window.addEventListener('drop', onDrop, true);
    window.addEventListener('blur', resetDrag);

    return () => {
      window.removeEventListener('dragenter', onDragEnter, true);
      window.removeEventListener('dragover', onDragOver, true);
      window.removeEventListener('dragleave', onDragLeave, true);
      window.removeEventListener('drop', onDrop, true);
      window.removeEventListener('blur', resetDrag);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !file || !importerHostRef.current) return;
    const signature = `${file.name}:${file.size}:${file.lastModified}`;
    if (injectedFileRef.current === signature) return;

    const input = importerHostRef.current.querySelector('input[type="file"]');
    if (!input) return;

    injectedFileRef.current = signature;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      const dropzone = importerHostRef.current.querySelector('.import-dropzone');
      if (!dropzone) return;
      const syntheticDrop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(syntheticDrop, 'dataTransfer', { value: { files: [file] } });
      dropzone.dispatchEvent(syntheticDrop);
    }
  }, [open, file]);

  const setImportedLeads = updater => {
    const current = latestLeadsRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;
    latestLeadsRef.current = Array.isArray(next) ? next : current;
    localStorage.setItem('zapflow-leads', JSON.stringify(latestLeadsRef.current));
    setLeadsState(latestLeadsRef.current);
    return latestLeadsRef.current;
  };

  const closeImporter = () => {
    setOpen(false);
    setFile(null);
    injectedFileRef.current = '';
  };

  const handleActivity = (lead, kind, title, detail = '', metadata = {}) => {
    if (!account?.id || !lead?.id) return;
    recordLeadActivity({ userId: account.id, leadId: lead.id, kind, title, detail, metadata }).catch(error => {
      console.error('Global import activity save failed:', error);
    });
  };

  const handleDone = async stats => {
    try {
      if (account?.id) {
        const synced = await syncLeads(latestLeadsRef.current, account.id);
        if (synced.length) {
          latestLeadsRef.current = synced;
          localStorage.setItem('zapflow-leads', JSON.stringify(synced));
        }
      }
      sessionStorage.setItem(FLASH_KEY, JSON.stringify(stats || {}));
      window.location.reload();
    } catch (error) {
      console.error('Global import sync failed:', error);
      setToast('Os contatos foram lidos, mas não consegui sincronizar agora. Tente importar novamente em alguns segundos.');
    }
  };

  return (
    <>
      {dragActive && !open && (
        <div className="global-import-overlay" aria-hidden="true">
          <div className="global-import-overlay-card">
            <div className="global-import-overlay-icon"><UploadCloud size={34} /></div>
            <strong>Solte para importar no Fuply</strong>
            <span>Você pode jogar a planilha ou PDF em qualquer lugar da tela.</span>
            <small>CSV · XLSX · XLS · XLSM · ODS · PDF e outros formatos compatíveis</small>
          </div>
        </div>
      )}

      {open && (
        <div ref={importerHostRef} className="global-import-host">
          <LeadImporter
            leads={leads}
            setLeads={setImportedLeads}
            onClose={closeImporter}
            onActivity={handleActivity}
            onDone={handleDone}
          />
        </div>
      )}

      {toast && (
        <div className="global-import-toast" role="status">
          <FileSpreadsheet size={17} />
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}
