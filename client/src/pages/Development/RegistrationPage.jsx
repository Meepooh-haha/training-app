import Registration from '../Registration.jsx';
import { useProject } from './ProjectShell.jsx';

export default function RegistrationPage() {
  const { project, reload } = useProject();
  return <Registration project={project} onSaved={reload} />;
}
