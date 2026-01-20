/**
 * EmailVerificationSent - Página de confirmación después del registro
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Button } from '../../components';
import { useUI } from '../../context';
import styles from '../Login/Login.module.css';
import registerStyles from '../Register/Register.module.css';

const EmailVerificationSent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useUI();
  
  const email = location.state?.email || '';
  const nickname = location.state?.nickname || '';
  
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Redirigir si no hay email
  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
    }
  }, [email, navigate]);

  // Countdown para botón de reenvío
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    setResendingEmail(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        showError('Error al reenviar el email');
      } else {
        showSuccess('Email reenviado correctamente');
        setResendCooldown(60); // 60 segundos de cooldown
      }
    } catch (error) {
      showError('Error al reenviar el email');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className={styles.loginCard}>
      <div className={styles.header}>
        <div className={styles.logo}>📧</div>
        <h1 className={styles.title}>¡Verifica tu correo!</h1>
        <p className={styles.subtitle}>Te enviamos un email de confirmación</p>
      </div>

      <div className={styles.body}>
        <div className={registerStyles.successInfo}>
          <div className={registerStyles.emailIcon}>✉️</div>
          <p className={registerStyles.verifyText}>
            Hemos enviado un enlace de verificación a:
          </p>
          <div className={registerStyles.emailAddress}>
            {email}
          </div>
          <p className={registerStyles.verifyInstructions}>
            Por favor revisa tu bandeja de entrada (y spam) y haz clic en el enlace para activar tu cuenta.
          </p>
          
          {nickname && (
            <div className={registerStyles.nicknameSection}>
              <p>Tu nickname único será:</p>
              <div className={registerStyles.nickname}>
                @{nickname}
              </div>
              <p className={registerStyles.nicknameHint}>
                Guárdalo, tus amigos lo usarán para agregarte.
              </p>
            </div>
          )}
        </div>

        <div className={registerStyles.confirmationActions}>
          <Button 
            fullWidth 
            size="lg"
            onClick={() => navigate('/login')}
            icon="🚀"
          >
            Ya verifiqué, ir a Iniciar Sesión
          </Button>

          <Button 
            fullWidth 
            size="lg"
            variant="secondary"
            onClick={handleResendEmail}
            disabled={resendingEmail || resendCooldown > 0}
            icon={resendingEmail ? '⏳' : '📧'}
          >
            {resendingEmail 
              ? 'Reenviando...' 
              : resendCooldown > 0 
                ? `Reenviar en ${resendCooldown}s` 
                : 'Reenviar Email de Verificación'
            }
          </Button>
        </div>
        
        <div className={registerStyles.resendHint}>
          <p>💡 <strong>¿No recibiste el correo?</strong></p>
          <ul>
            <li>Revisa tu carpeta de spam o correo no deseado</li>
            <li>Espera unos minutos, a veces tarda un poco</li>
            <li>Verifica que el email sea correcto: <strong>{email}</strong></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationSent;
