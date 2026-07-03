import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';

export default function InvoiceIntakePage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [project, setProject] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/training-projects/${projectId}`).then(setProject).catch((e) => toast.error(e.message));
  }, [projectId]);

  return (
    <div className="space-y-5 font-body">
      {projectId && (
        <Link
          to={`/development/workflow/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> กลับไปที่ Workflow{project ? `: ${project.name}` : ''}
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold text-ink-900 font-display">รับ Invoice</h1>
        <p className="text-sm text-ink-500 mt-0.5">อัปโหลด Invoice เพื่อสกัดข้อมูลสำหรับใบ PR และใบ Memo</p>
      </div>

      <div
        className="rounded-xl border border-dashed border-ink-200 py-20 text-center text-sm text-ink-400"
        style={{ background: '#FAF7F6' }}
      >
        <Receipt className="w-8 h-8 mx-auto mb-2 text-ink-200" />
        ฟีเจอร์นี้กำลังพัฒนา — จะเปิดใช้งานเร็ว ๆ นี้
      </div>
    </div>
  );
}
