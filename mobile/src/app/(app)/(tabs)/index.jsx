import { useAuth } from '../../../context/AuthContext';
import AdminHome from '../../../features/home/AdminHome';
import AthleteHome from '../../../features/home/AthleteHome';
import CoachHome from '../../../features/home/CoachHome';

/** La pestaña de inicio muestra un tablero distinto según el rol. */
export default function Home() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminHome />;
  if (user?.role === 'coach') return <CoachHome />;
  return <AthleteHome />;
}
