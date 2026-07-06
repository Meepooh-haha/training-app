import Evaluation from '../Evaluation.jsx';
import { useProject } from './ProjectShell.jsx';

export default function EvaluationPage() {
  const { project, reload } = useProject();
  return <Evaluation project={project} onSaved={reload} />;
}
