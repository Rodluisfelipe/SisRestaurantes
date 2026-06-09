/**
 * CrewEmployerApp — shell principal para empleadores Crew.
 *
 * Rutea entre landing/login/signup/pending/dashboard:
 *   - bootstrap → spinner
 *   - !isAuthed → 'landing' (default) | 'login' | 'signup'
 *   - isAuthed && !isApproved → pantalla de estado (pending/rejected/etc)
 *   - isAuthed && isApproved → dashboard completo
 */
import { useCrewEmployer, CrewEmployerProvider } from './useCrewEmployer';
import CrewEmployerLanding from './CrewEmployerLanding';
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
  // Empezamos en la landing — primero el valor, después el formulario.
  const [screen, setScreen] = useState('landing'); // 'landing' | 'login' | 'signup'

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
      return (
        <CrewEmployerSignup
          onSwitch={() => setScreen('login')}
          onBack={() => setScreen('landing')}
        />
      );
    }
    if (screen === 'login') {
      return (
        <CrewEmployerLogin
          onSwitch={() => setScreen('signup')}
          onBack={() => setScreen('landing')}
        />
      );
    }
    return <CrewEmployerLanding onLogin={() => setScreen('login')} onSignup={() => setScreen('signup')} />;
  }

  // Autenticado pero pendiente/rechazado/suspendido
  if (!isApproved) {
    return <CrewEmployerPending />;
  }

  // Aprobado → dashboard completo
  return <CrewEmployerDashboard />;
}
