/**
 * CrewEmployerApp — shell principal para empleadores Crew.
 * Rutea entre login/signup/pending/dashboard según estado de auth.
 */
import { useCrewEmployer, CrewEmployerProvider } from './useCrewEmployer';
import CrewEmployerLogin from './CrewEmployerLogin';
import CrewEmployerSignup from './CrewEmployerSignup';
import CrewEmployerPending from './CrewEmployerPending';
import CrewEmployerDashboard from './CrewEmployerDashboard';
import { useState } from 'react';

export default function CrewEmployerApp() {
  return (
    <CrewEmployerProvider>
      <CrewEmployerRouter />
    </CrewEmployerProvider>
  );
}

function CrewEmployerRouter() {
  const { bootstrapped, isAuthed, isApproved } = useCrewEmployer();
  const [screen, setScreen] = useState('login'); // login | signup

  if (!bootstrapped) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500" />
      </div>
    );
  }

  // No autenticado
  if (!isAuthed) {
    if (screen === 'signup') {
      return <CrewEmployerSignup onSwitch={() => setScreen('login')} />;
    }
    return <CrewEmployerLogin onSwitch={() => setScreen('signup')} />;
  }

  // Autenticado pero pendiente/rechazado/suspendido
  if (!isApproved) {
    return <CrewEmployerPending />;
  }

  // Aprobado → dashboard completo
  return <CrewEmployerDashboard />;
}
