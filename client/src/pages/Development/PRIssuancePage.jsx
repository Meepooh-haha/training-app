import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import PRForm from '../PRForm.jsx';
import { api } from '../../lib/api.js';
import { useProject } from './ProjectShell.jsx';

// โหลด Invoice ที่ยืนยันแล้วของโครงการก่อน แล้วค่อย render ฟอร์ม —
// PRForm seed ค่าตั้งต้นครั้งเดียวตอน mount จึงต้องมีข้อมูลพร้อมก่อน
export default function PRIssuancePage() {
  const { project, projectId } = useProject();
  const [invoices, setInvoices] = useState(null);

  useEffect(() => {
    api.get(`/invoices/extractions?project_id=${projectId}`)
      .then((list) => setInvoices(list.filter((v) => v.status === 'confirmed').map((v) => v.extraction_data)))
      .catch(() => setInvoices([]));
  }, [projectId]);

  if (invoices === null) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }
  return <PRForm project={project} invoices={invoices} />;
}
