import MemoForm from '../MemoForm.jsx';
import { useProject } from './ProjectShell.jsx';

export default function MemoIssuancePage() {
  const { project } = useProject();
  return <MemoForm project={project} />;
}
