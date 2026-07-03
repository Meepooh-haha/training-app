import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import MemoForm from '../MemoForm.jsx';

export default function MemoIssuancePage() {
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

      <MemoForm />
    </div>
  );
}
