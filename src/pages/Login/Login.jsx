/**
 * Login Page
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context';
import { Button, Input } from '../../components';
import styles from './Login.module.css';

const Login = () => {
  const { signIn, loading, error, clearError } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
    if (error) clearError();
  };

  const validate = () => {
    const errors = {};
    if (!formData.email) {
      errors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email inválido';
    }
    if (!formData.password) {
      errors.password = 'La contraseña es requerida';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    await signIn(formData.email, formData.password);
  };

  return (
    <div className={styles.loginCard}>
      <div className={styles.header}>
        <div className={styles.logo}>💎</div>
        <h1 className={styles.title}>GestorDeudas</h1>
        <p className={styles.subtitle}>Inicia sesión para continuar</p>
      </div>

      <div className={styles.body}>
        {error && (
          <div className={styles.error}>
            {error.includes('Email not confirmed') || error.includes('not confirmed')
              ? '📧 Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.'
              : error.includes('Invalid login credentials')
              ? 'Email o contraseña incorrectos'
              : error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="tu@email.com"
            value={formData.email}
            onChange={handleChange}
            error={formErrors.email}
            icon="📧"
          />

          <Input
            label="Contraseña"
            type="password"
            name="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            error={formErrors.password}
            icon="🔒"
          />

          <div className={styles.forgotPassword}>
            <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
          </div>

          <Button 
            type="submit" 
            fullWidth 
            size="lg"
            loading={loading}
          >
            Iniciar Sesión
          </Button>
        </form>
      </div>

      <div className={styles.footer}>
        ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
      </div>
    </div>
  );
};

export default Login;
