import PRForm from '../PRForm.jsx';
import { useProject } from './ProjectShell.jsx';

export default function PRIssuancePage() {
  const { project } = useProject();
  return <PRForm project={project} />;
}
