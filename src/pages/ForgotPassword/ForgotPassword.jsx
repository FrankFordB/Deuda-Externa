/**
 * ForgotPassword Page - Solicitar recuperación de contraseña
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useUI } from '../../context';
import { Button, Input, Card } from '../../components';
import styles from '../Login/Login.module.css';
import forgotStyles from './ForgotPassword.module.css';

const ForgotPassword = () => {
  const { sendPasswordReset, clearError, error } = useAuth();
  const { showSuccess } = useUI();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!email.trim()) {
      return;
    }

    if (!validateEmail(email)) {
      return;
    }

    if (cooldown > 0) {
      return;
    }

    setLoading(true);
    const result = await sendPasswordReset(email);
    setLoading(false);

    // Siempre mostrar éxito por seguridad (no revelar si el email existe)
    setSent(true);
    setCooldown(60); // 60 segundos de cooldown
    showSuccess('Si el email existe, recibirás instrucciones para restablecer tu contraseña');
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    
    setLoading(true);
    await sendPasswordReset(email);
    setLoading(false);
    setCooldown(60);
    showSuccess('Email reenviado');
  };

  if (sent) {
    return (
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.logo}>📧</div>
          <h1 className={styles.title}>Revisa tu correo</h1>
          <p className={styles.subtitle}>
            Hemos enviado instrucciones a <strong>{email}</strong>
          </p>
        </div>

        <div className={styles.body}>
          <div className={forgotStyles.successMessage}>
            <div className={forgotStyles.successIcon}>✅</div>
            <p>
              Si existe una cuenta asociada a este email, recibirás un enlace 
              para restablecer tu contraseña en los próximos minutos.
            </p>
            <p className={forgotStyles.hint}>
              No olvides revisar tu carpeta de spam.
            </p>
          </div>

          <div className={forgotStyles.actions}>
            <Button
              variant="secondary"
              onClick={handleResend}
              disabled={cooldown > 0}
              loading={loading}
              fullWidth
            >
              {cooldown > 0 
                ? `Reenviar en ${cooldown}s` 
                : 'Reenviar email'}
            </Button>

            <Link to="/login" className={forgotStyles.backLink}>
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginCard}>
      <div className={styles.header}>
        <div className={styles.logo}>🔐</div>
        <h1 className={styles.title}>¿Olvidaste tu contraseña?</h1>
        <p className={styles.subtitle}>
          Ingresa tu email y te enviaremos instrucciones
        </p>
      </div>

      <div className={styles.body}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            type="email"
            label="Email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            autoFocus
            icon="📧"
          />

          {error && (
            <div className={forgotStyles.error}>
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            loading={loading} 
            fullWidth
            disabled={cooldown > 0}
          >
            {cooldown > 0 
              ? `Espera ${cooldown}s` 
              : 'Enviar instrucciones'}
          </Button>
        </form>

        <div className={styles.footer}>
          <p>
            ¿Recordaste tu contraseña?{' '}
            <Link to="/login" className={styles.link}>
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
