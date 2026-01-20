/**
 * Settings Page - Configuración del usuario
 */
import { useState } from 'react';
import { useAuth, useUI } from '../../context';
import { Button, Card, Input } from '../../components';
import styles from './Settings.module.css';

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

const Settings = () => {
  const { changePassword, signOut, deleteAccount } = useAuth();
  const { showSuccess, showError, siteConfig } = useUI();

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [touched, setTouched] = useState({});
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlePasswordChange = (e) => {
    setPasswordData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const passwordErrors = validatePassword(passwordData.newPassword);
  const passwordStrength = getPasswordStrength(passwordData.newPassword);
  const passwordsMatch = passwordData.newPassword === passwordData.confirmPassword;
  const isValid = passwordErrors.length === 0 && passwordsMatch && passwordData.confirmPassword && passwordData.currentPassword;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setTouched({ currentPassword: true, newPassword: true, confirmPassword: true });

    if (!passwordsMatch) {
      showError('Las contraseñas no coinciden');
      return;
    }

    if (passwordErrors.length > 0) {
      showError('La contraseña no cumple los requisitos');
      return;
    }

    setChangingPassword(true);
    const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);
    setChangingPassword(false);

    if (result.success) {
      showSuccess('Contraseña actualizada correctamente');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setTouched({});
      setShowPasswordForm(false);
    } else {
      showError(result.error?.message || 'Error al cambiar contraseña');
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      await signOut();
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setDeletingAccount(true);
    const result = await deleteAccount();
    setDeletingAccount(false);

    if (result.success) {
      showSuccess('Cuenta eliminada correctamente');
      // El usuario será redirigido automáticamente al login
    } else {
      showError(result.error?.message || 'Error al eliminar cuenta');
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className={styles.settings}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Configuración</h2>
        <p className={styles.subtitle}>Gestiona tu cuenta y preferencias</p>
      </div>

      <div className={styles.content}>
        {/* Seguridad */}
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>🔐 Seguridad</h3>
          
          {!showPasswordForm ? (
            <div className={styles.sectionContent}>
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Contraseña</span>
                  <span className={styles.settingValue}>••••••••</span>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Cambiar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className={styles.passwordForm}>
              <Input
                label="Contraseña Actual"
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                onBlur={() => handleBlur('currentPassword')}
                placeholder="Tu contraseña actual"
                required
                icon="🔐"
              />
              
              <div className={styles.passwordInputGroup}>
                <Input
                  label="Nueva Contraseña"
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  onBlur={() => handleBlur('newPassword')}
                  placeholder="Mínimo 8 caracteres"
                  required
                  icon="🔑"
                  error={touched.newPassword && passwordErrors.length > 0}
                />

                {/* Indicador de fortaleza */}
                {passwordData.newPassword && (
                  <div className={styles.strengthIndicator}>
                    <div className={styles.strengthBar}>
                      <div 
                        className={styles.strengthFill}
                        style={{ 
                          width: passwordStrength.level === 'weak' ? '33%' : 
                                 passwordStrength.level === 'medium' ? '66%' : '100%',
                          backgroundColor: passwordStrength.color
                        }}
                      />
                    </div>
                    <span 
                      className={styles.strengthLabel}
                      style={{ color: passwordStrength.color }}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                )}

                {/* Requisitos */}
                {touched.newPassword && passwordData.newPassword && (
                  <div className={styles.requirements}>
                    <div className={`${styles.requirement} ${passwordData.newPassword.length >= 8 ? styles.valid : styles.invalid}`}>
                      {passwordData.newPassword.length >= 8 ? '✓' : '○'} Mínimo 8 caracteres
                    </div>
                    <div className={`${styles.requirement} ${PASSWORD_RULES.hasUppercase.test(passwordData.newPassword) ? styles.valid : styles.invalid}`}>
                      {PASSWORD_RULES.hasUppercase.test(passwordData.newPassword) ? '✓' : '○'} Una mayúscula
                    </div>
                    <div className={`${styles.requirement} ${PASSWORD_RULES.hasNumber.test(passwordData.newPassword) ? styles.valid : styles.invalid}`}>
                      {PASSWORD_RULES.hasNumber.test(passwordData.newPassword) ? '✓' : '○'} Un número
                    </div>
                  </div>
                )}
              </div>

              <Input
                label="Confirmar Nueva Contraseña"
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                onBlur={() => handleBlur('confirmPassword')}
                placeholder="Repite la nueva contraseña"
                required
                icon="🔐"
                error={touched.confirmPassword && !passwordsMatch && passwordData.confirmPassword}
                hint={touched.confirmPassword && !passwordsMatch && passwordData.confirmPassword ? 'Las contraseñas no coinciden' : ''}
              />
              <div className={styles.formActions}>
                <Button 
                  variant="ghost" 
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                    setTouched({});
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  loading={changingPassword}
                  disabled={!isValid}
                >
                  Cambiar Contraseña
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Información del sitio */}
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>ℹ️ Información</h3>
          <div className={styles.sectionContent}>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Nombre del Sitio</span>
                <span className={styles.infoValue}>{siteConfig?.site_name || 'DebtTracker'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Moneda</span>
                <span className={styles.infoValue}>{siteConfig?.currency || '$'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Versión</span>
                <span className={styles.infoValue}>1.0.0</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Sesión */}
        <Card className={`${styles.section} ${styles.dangerSection}`}>
          <h3 className={styles.sectionTitle}>🚪 Sesión</h3>
          <div className={styles.sectionContent}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Cerrar sesión</span>
                <span className={styles.settingHint}>
                  Se cerrará tu sesión en este dispositivo
                </span>
              </div>
              <Button 
                variant="danger" 
                onClick={handleSignOut}
              >
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </Card>

        {/* Zona de peligro */}
        <Card className={`${styles.section} ${styles.dangerSection}`}>
          <h3 className={styles.sectionTitle}>⚠️ Zona de Peligro</h3>
          <div className={styles.sectionContent}>
            <div className={styles.dangerItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Eliminar Cuenta</span>
                <span className={styles.settingHint}>
                  Esta acción es irreversible. Se eliminarán todos tus datos permanentemente.
                </span>
                {showDeleteConfirm && (
                  <div className={styles.deleteConfirmBox}>
                    <span className={styles.confirmText}>
                      ⚠️ ¿Estás completamente seguro? Esta acción NO se puede deshacer.
                    </span>
                    <div className={styles.confirmActions}>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        variant="danger" 
                        size="sm"
                        onClick={handleDeleteAccount}
                        loading={deletingAccount}
                      >
                        Sí, eliminar mi cuenta
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {!showDeleteConfirm && (
                <Button 
                  variant="danger"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                >
                  Eliminar Cuenta
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
