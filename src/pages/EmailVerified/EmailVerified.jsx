/**
 * EmailVerified - Pantalla de confirmación exitosa de email
 * Se muestra cuando el usuario confirma su email desde el link enviado
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components';
import styles from '../Login/Login.module.css';
import localStyles from './EmailVerified.module.css';

const EmailVerified = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown automático para redirigir
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      navigate('/login');
    }
  }, [countdown, navigate]);

  return (
    <div className={styles.loginCard}>
      <div className={styles.header}>
        <div className={localStyles.successIcon}>✅</div>
        <h1 className={styles.title}>¡Email Verificado!</h1>
        <p className={styles.subtitle}>Tu cuenta ha sido activada correctamente</p>
      </div>

      <div className={styles.body}>
        <div className={localStyles.successMessage}>
          <div className={localStyles.checkmark}>
            <div className={localStyles.checkmarkCircle}>
              <div className={localStyles.checkmarkStem}></div>
              <div className={localStyles.checkmarkKick}></div>
            </div>
          </div>
          
          <p className={localStyles.messageText}>
            Tu cuenta está ahora activa y lista para usar.
          </p>
          
          <p className={localStyles.redirectText}>
            Serás redirigido al login en <strong>{countdown}</strong> segundo{countdown !== 1 ? 's' : ''}...
          </p>
        </div>

        <div className={localStyles.actions}>
          <Button 
            fullWidth 
            size="lg"
            onClick={() => navigate('/login')}
            icon="🚀"
          >
            Iniciar Sesión Ahora
          </Button>

          <Button 
            fullWidth 
            size="lg"
            variant="secondary"
            onClick={() => navigate('/')}
          >
            Volver al Inicio
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerified;
