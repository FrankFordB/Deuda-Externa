/**
 * Register Page
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useUI } from '../../context';
import { Button, Input, Select } from '../../components';
import styles from '../Login/Login.module.css';
import registerStyles from './Register.module.css';

const COUNTRIES = [
  { value: 'AR', label: 'Argentina (ARS)' },
  { value: 'BR', label: 'Brasil (BRL)' },
  { value: 'CL', label: 'Chile (CLP)' },
  { value: 'CO', label: 'Colombia (COP)' },
  { value: 'MX', label: 'México (MXN)' },
  { value: 'PE', label: 'Perú (PEN)' },
  { value: 'US', label: 'Estados Unidos (USD)' },
  { value: 'ES', label: 'España (EUR)' },
  { value: 'OTHER', label: 'Otro' }
];

const Register = () => {
  const { signUp, loading, error, clearError } = useAuth();
  const { showSuccess } = useUI();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    country: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [registeredNickname, setRegisteredNickname] = useState(null);

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
    } else if (formData.password.length < 6) {
      errors.password = 'Mínimo 6 caracteres';
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }
    
    if (!formData.firstName) {
      errors.firstName = 'El nombre es requerido';
    }
    
    if (!formData.lastName) {
      errors.lastName = 'El apellido es requerido';
    }
    
    if (!formData.birthDate) {
      errors.birthDate = 'La fecha de nacimiento es requerida';
    } else {
      const birthDate = new Date(formData.birthDate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 13) {
        errors.birthDate = 'Debes tener al menos 13 años';
      }
    }
    
    if (!formData.country) {
      errors.country = 'El país es requerido';
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

    const result = await signUp({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      birthDate: formData.birthDate,
      country: formData.country
    });

    if (result.success) {
      setRegisteredNickname(result.nickname);
      showSuccess('¡Cuenta creada! Revisa tu correo para verificar.');
    }
  };

  if (registeredNickname) {
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
              {formData.email}
            </div>
            <p className={registerStyles.verifyInstructions}>
              Por favor revisa tu bandeja de entrada (y spam) y haz clic en el enlace para activar tu cuenta.
            </p>
            
            <div className={registerStyles.nicknameSection}>
              <p>Tu nickname único será:</p>
              <div className={registerStyles.nickname}>
                @{registeredNickname}
              </div>
              <p className={registerStyles.nicknameHint}>
                Guárdalo, tus amigos lo usarán para agregarte.
              </p>
            </div>
          </div>

          <Button 
            fullWidth 
            size="lg"
            onClick={() => navigate('/login')}
            icon="🚀"
          >
            Ya verifiqué, ir a Iniciar Sesión
          </Button>
          
          <p className={registerStyles.resendHint}>
            ¿No recibiste el correo? Espera unos minutos o revisa tu carpeta de spam.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginCard}>
      <div className={styles.header}>
        <div className={styles.logo}>💎</div>
        <h1 className={styles.title}>Crear Cuenta</h1>
        <p className={styles.subtitle}>Únete a GestorDeudas</p>
      </div>

      <div className={styles.body}>
        {error && (
          <div className={styles.error}>
            {error.includes('security purposes') || error.includes('rate limit') 
              ? 'Por favor espera unos segundos antes de intentar nuevamente'
              : error.includes('already registered')
              ? 'Este email ya está registrado. ¿Quieres iniciar sesión?'
              : error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={registerStyles.row}>
            <Input
              label="Nombre"
              name="firstName"
              placeholder="Juan"
              value={formData.firstName}
              onChange={handleChange}
              error={formErrors.firstName}
            />
            <Input
              label="Apellido"
              name="lastName"
              placeholder="Pérez"
              value={formData.lastName}
              onChange={handleChange}
              error={formErrors.lastName}
            />
          </div>

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

          <div className={registerStyles.row}>
            <Input
              label="Contraseña"
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              error={formErrors.password}
            />
            <Input
              label="Confirmar"
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={formErrors.confirmPassword}
            />
          </div>

          <Input
            label="Fecha de Nacimiento"
            type="date"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleChange}
            error={formErrors.birthDate}
          />

          <Select
            label="País / Moneda"
            name="country"
            options={COUNTRIES}
            value={formData.country}
            onChange={handleChange}
            error={formErrors.country}
          />

          <p className={registerStyles.nicknameNote}>
            📝 Tu nickname único se generará automáticamente al registrarte.
          </p>

          <Button 
            type="submit" 
            fullWidth 
            size="lg"
            loading={loading}
          >
            Crear Cuenta
          </Button>
        </form>
      </div>

      <div className={styles.footer}>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </div>
    </div>
  );
};

export default Register;
