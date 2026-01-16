/**
 * ResetPassword Page - Restablecer contraseña con token
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useUI } from '../../context';
import { Button, Input } from '../../components';
import styles from '../Login/Login.module.css';
import resetStyles from './ResetPassword.module.css';

// Validaciones de contraseña
const PASSWORD_RULES = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasNumber: /[0-9]/
};

const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Mínimo ${PASSWORD_RULES.minLength} caracteres`);
  }
  if (!PASSWORD_RULES.hasUppercase.test(password)) {
    errors.push('Al menos una mayúscula');
  }
  if (!PASSWORD_RULES.hasNumber.test(password)) {
    errors.push('Al menos un número');
  }
  
  return errors;
};

const getPasswordStrength = (password) => {
  let strength = 0;
  if (password.length >= PASSWORD_RULES.minLength) strength++;
  if (PASSWORD_RULES.hasUppercase.test(password)) strength++;
  if (PASSWORD_RULES.hasNumber.test(password)) strength++;
  if (password.length >= 12) strength++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
  
  if (strength <= 1) return { level: 'weak', label: 'Débil', color: 'var(--danger)' };
  if (strength <= 3) return { level: 'medium', label: 'Media', color: 'var(--warning)' };
  return { level: 'strong', label: 'Fuerte', color: 'var(--success)' };
};

const ResetPassword = () => {
  const { updatePasswordWithToken, checkRecoverySession, error, clearError } = useAuth();
  const { showSuccess, showError } = useUI();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState({});

  // Verificar si hay una sesión de recuperación válida
  useEffect(() => {
    const checkSession = async () => {
      setValidating(true);
      
      // Verificar hash params de Supabase
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      const errorDescription = hashParams.get('error_description');
      
      if (errorDescription) {
        showError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        setIsValidSession(false);
        setValidating(false);
        return;
      }
      
      if (type === 'recovery' && accessToken) {
        setIsValidSession(true);
      } else {
        const { isRecoverySession } = await checkRecoverySession();
        setIsValidSession(isRecoverySession);
      }
      
      setValidating(false);
    };

    checkSession();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearError();
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const passwordErrors = validatePassword(formData.password);
  const passwordStrength = getPasswordStrength(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword;
  const isValid = passwordErrors.length === 0 && passwordsMatch && formData.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ password: true, confirmPassword: true });

    if (!isValid) {
      return;
    }

    setLoading(true);
    const result = await updatePasswordWithToken(formData.password);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      showSuccess('Contraseña actualizada correctamente');
    } else {
      showError(result.error?.message || 'Error al actualizar contraseña');
    }
  };

  // Pantalla de carga mientras valida
  if (validating) {
    return (
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={resetStyles.loadingIcon}>⏳</div>
          <h1 className={styles.title}>Verificando...</h1>
          <p className={styles.subtitle}>Validando tu enlace de recuperación</p>
        </div>
      </div>
    );
  }

  // Sesión inválida o expirada
  if (!isValidSession && !success) {
    return (
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={resetStyles.errorIcon}>❌</div>
          <h1 className={styles.title}>Enlace inválido</h1>
          <p className={styles.subtitle}>
            Este enlace ha expirado o no es válido
          </p>
        </div>

        <div className={styles.body}>
          <div className={resetStyles.errorMessage}>
            <p>
              Los enlaces de recuperación expiran después de un tiempo por seguridad.
              Por favor, solicita un nuevo enlace.
            </p>
          </div>

          <Link to="/forgot-password">
            <Button fullWidth>
              Solicitar nuevo enlace
            </Button>
          </Link>

          <div className={styles.footer}>
            <Link to="/login" className={resetStyles.backLink}>
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Éxito al cambiar contraseña
  if (success) {
    return (
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={resetStyles.successIcon}>✅</div>
          <h1 className={styles.title}>¡Contraseña actualizada!</h1>
          <p className={styles.subtitle}>
            Tu contraseña ha sido cambiada exitosamente
          </p>
        </div>

        <div className={styles.body}>
          <div className={resetStyles.successMessage}>
            <p>
              Ya puedes iniciar sesión con tu nueva contraseña.
              Se han cerrado las sesiones en otros dispositivos por seguridad.
            </p>
          </div>

          <Link to="/login">
            <Button fullWidth icon="🚀">
              Ir a iniciar sesión
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Formulario de nueva contraseña
  return (
    <div className={styles.loginCard}>
      <div className={styles.header}>
        <div className={styles.logo}>🔒</div>
        <h1 className={styles.title}>Nueva contraseña</h1>
        <p className={styles.subtitle}>
          Crea una contraseña segura para tu cuenta
        </p>
      </div>

      <div className={styles.body}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={resetStyles.inputGroup}>
            <Input
              type="password"
              label="Nueva contraseña"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onBlur={() => handleBlur('password')}
              placeholder="Mínimo 8 caracteres"
              required
              autoFocus
              icon="🔐"
              error={touched.password && passwordErrors.length > 0}
            />

            {/* Indicador de fortaleza */}
            {formData.password && (
              <div className={resetStyles.strengthIndicator}>
                <div className={resetStyles.strengthBar}>
                  <div 
                    className={resetStyles.strengthFill}
                    style={{ 
                      width: passwordStrength.level === 'weak' ? '33%' : 
                             passwordStrength.level === 'medium' ? '66%' : '100%',
                      backgroundColor: passwordStrength.color
                    }}
                  />
                </div>
                <span 
                  className={resetStyles.strengthLabel}
                  style={{ color: passwordStrength.color }}
                >
                  {passwordStrength.label}
                </span>
              </div>
            )}

            {/* Requisitos */}
            {touched.password && formData.password && (
              <div className={resetStyles.requirements}>
                <div className={`${resetStyles.requirement} ${formData.password.length >= 8 ? resetStyles.valid : resetStyles.invalid}`}>
                  {formData.password.length >= 8 ? '✓' : '○'} Mínimo 8 caracteres
                </div>
                <div className={`${resetStyles.requirement} ${PASSWORD_RULES.hasUppercase.test(formData.password) ? resetStyles.valid : resetStyles.invalid}`}>
                  {PASSWORD_RULES.hasUppercase.test(formData.password) ? '✓' : '○'} Una mayúscula
                </div>
                <div className={`${resetStyles.requirement} ${PASSWORD_RULES.hasNumber.test(formData.password) ? resetStyles.valid : resetStyles.invalid}`}>
                  {PASSWORD_RULES.hasNumber.test(formData.password) ? '✓' : '○'} Un número
                </div>
              </div>
            )}
          </div>

          <Input
            type="password"
            label="Confirmar contraseña"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            onBlur={() => handleBlur('confirmPassword')}
            placeholder="Repite la contraseña"
            required
            icon="🔐"
            error={touched.confirmPassword && !passwordsMatch && formData.confirmPassword}
            hint={touched.confirmPassword && !passwordsMatch && formData.confirmPassword ? 'Las contraseñas no coinciden' : ''}
          />

          {error && (
            <div className={resetStyles.error}>
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            loading={loading} 
            fullWidth
            disabled={!isValid}
          >
            Cambiar contraseña
          </Button>
        </form>

        <div className={styles.footer}>
          <Link to="/login" className={resetStyles.backLink}>
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
