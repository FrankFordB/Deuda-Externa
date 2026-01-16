/**
 * Profile Page - Perfil del usuario
 */
import { useState, useRef } from 'react';
import { useAuth, useFriends, useExpenses, useDebts, useUI } from '../../context';
import { Button, Card, Input, Select, Loading } from '../../components';
import avatarService from '../../services/avatarService';
import styles from './Profile.module.css';

const Profile = () => {
  const { user, profile, updateProfile, reloadProfile, loading: authLoading } = useAuth();
  const { friends } = useFriends();
  const { expenses } = useExpenses();
  const { summary } = useDebts();
  const { showSuccess, showError, siteConfig } = useUI();

  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    country: profile?.country || '',
    birth_date: profile?.birth_date || ''
  });

  const currency = siteConfig?.currency || '$';

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfile(formData);
    setSaving(false);

    if (result.success) {
      showSuccess('Perfil actualizado');
      setIsEditing(false);
    } else {
      showError(result.error?.message || 'Error al actualizar');
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      country: profile?.country || '',
      birth_date: profile?.birth_date || ''
    });
    setIsEditing(false);
  };

  const copyNickname = () => {
    navigator.clipboard.writeText(profile?.nickname || '');
    showSuccess('Nickname copiado al portapapeles');
  };

  // Manejo de avatar
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const result = await avatarService.uploadAvatar(user.id, file);
    setUploadingAvatar(false);

    if (result.error) {
      showError(result.error.message || 'Error al subir la foto');
    } else {
      showSuccess('Foto de perfil actualizada');
      // Recargar perfil para obtener la nueva URL
      if (reloadProfile) {
        await reloadProfile();
      }
    }
    
    // Limpiar input
    e.target.value = '';
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm('¿Eliminar tu foto de perfil?')) return;

    setUploadingAvatar(true);
    const result = await avatarService.deleteAvatar(user.id);
    setUploadingAvatar(false);

    if (result.error) {
      showError('Error al eliminar la foto');
    } else {
      showSuccess('Foto eliminada');
      if (reloadProfile) {
        await reloadProfile();
      }
    }
  };

  // Estadísticas
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('es-AR', { year: 'numeric', month: 'long' })
    : '-';

  if (authLoading) {
    return <Loading size="lg" text="Cargando perfil..." />;
  }

  return (
    <div className={styles.profile}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Mi Perfil</h2>
      </div>

      <div className={styles.content}>
        {/* Profile Card */}
        <Card className={styles.profileCard}>
          <div className={styles.avatarSection}>
            <div 
              className={`${styles.avatar} ${styles.clickable} ${uploadingAvatar ? styles.uploading : ''}`}
              onClick={handleAvatarClick}
              title="Cambiar foto de perfil"
            >
              {uploadingAvatar ? (
                <span className={styles.avatarLoading}>⏳</span>
              ) : profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  className={styles.avatarImage}
                />
              ) : (
                <>{profile?.first_name?.[0]}{profile?.last_name?.[0]}</>
              )}
              <div className={styles.avatarOverlay}>
                📷
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleAvatarChange}
              className={styles.hiddenInput}
            />
            <div className={styles.avatarInfo}>
              <h3 className={styles.userName}>
                {profile?.first_name} {profile?.last_name}
              </h3>
              <div className={styles.nicknameRow}>
                <span className={styles.nickname}>@{profile?.nickname}</span>
                <button className={styles.copyBtn} onClick={copyNickname} title="Copiar nickname">
                  📋
                </button>
              </div>
              <p className={styles.email}>{user?.email}</p>
              {profile?.avatar_url && (
                <button 
                  className={styles.deleteAvatarBtn} 
                  onClick={handleDeleteAvatar}
                  disabled={uploadingAvatar}
                >
                  🗑️ Quitar foto
                </button>
              )}
            </div>
          </div>

          <div className={styles.nicknameCard}>
            <div className={styles.nicknameLabel}>Tu Nickname Único</div>
            <div className={styles.nicknameValue}>@{profile?.nickname}</div>
            <p className={styles.nicknameHint}>
              Comparte este nickname con tus amigos para que te agreguen
            </p>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{friends.length}</span>
              <span className={styles.statLabel}>Amigos</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{expenses.length}</span>
              <span className={styles.statLabel}>Gastos</span>
            </div>
            <div className={styles.statItem}>
              <span className={`${styles.statValue} ${((summary?.owed || 0) - (summary?.owe || 0)) >= 0 ? styles.positive : styles.negative}`}>
                {currency}{Math.abs((summary?.owed || 0) - (summary?.owe || 0)).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
              <span className={styles.statLabel}>
                {((summary?.owed || 0) - (summary?.owe || 0)) >= 0 ? 'Te deben' : 'Debes'}
              </span>
            </div>
          </div>
        </Card>

        {/* Edit Form */}
        <Card className={styles.formCard}>
          <div className={styles.formHeader}>
            <h3>Información Personal</h3>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                ✏️ Editar
              </Button>
            )}
          </div>

          <div className={styles.form}>
            <div className={styles.formRow}>
              <Input
                label="Nombre"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                disabled={!isEditing}
              />
              <Input
                label="Apellido"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>

            <Input
              label="Email"
              type="email"
              value={user?.email || ''}
              disabled
              hint="El email no se puede modificar"
            />

            <Input
              label="Nickname"
              value={profile?.nickname || ''}
              disabled
              hint="El nickname es único y no se puede cambiar"
            />

            <Select
              label="País"
              name="country"
              value={formData.country}
              onChange={handleChange}
              disabled={!isEditing}
              options={[
                { value: '', label: 'Seleccionar país' },
                { value: 'AR', label: '🇦🇷 Argentina' },
                { value: 'CL', label: '🇨🇱 Chile' },
                { value: 'UY', label: '🇺🇾 Uruguay' },
                { value: 'PY', label: '🇵🇾 Paraguay' },
                { value: 'BO', label: '🇧🇴 Bolivia' },
                { value: 'PE', label: '🇵🇪 Perú' },
                { value: 'CO', label: '🇨🇴 Colombia' },
                { value: 'EC', label: '🇪🇨 Ecuador' },
                { value: 'VE', label: '🇻🇪 Venezuela' },
                { value: 'MX', label: '🇲🇽 México' },
                { value: 'ES', label: '🇪🇸 España' },
                { value: 'US', label: '🇺🇸 Estados Unidos' },
                { value: 'BR', label: '🇧🇷 Brasil' },
                { value: 'OTHER', label: '🌍 Otro' }
              ]}
            />

            <Input
              label="Fecha de Nacimiento"
              type="date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleChange}
              disabled={!isEditing}
            />

            {isEditing && (
              <div className={styles.formActions}>
                <Button variant="ghost" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} loading={saving}>
                  Guardar Cambios
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Account Info */}
        <Card className={styles.infoCard}>
          <h3>Información de la Cuenta</h3>
          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Miembro desde</span>
              <span className={styles.infoValue}>{memberSince}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Total gastado</span>
              <span className={styles.infoValue}>
                {currency}{totalExpenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Rol</span>
              <span className={styles.infoValue}>
                {profile?.is_superadmin ? '👑 Super Admin' : '👤 Usuario'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
