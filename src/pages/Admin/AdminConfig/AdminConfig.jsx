/**
 * Admin Config - Configuración del sitio
 */
import { useState, useEffect } from 'react';
import { useUI } from '../../../context';
import { adminService } from '../../../services';
import { Button, Card, Input, Select, Loading } from '../../../components';
import styles from './AdminConfig.module.css';

const AdminConfig = () => {
  const { siteConfig, loadSiteConfig, showSuccess, showError } = useUI();

  const [config, setConfig] = useState({
    site_name: '',
    currency: '$',
    primary_color: '#6366f1',
    allow_registration: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (siteConfig) {
      setConfig({
        site_name: siteConfig.site_name || 'DebtTracker',
        currency: siteConfig.currency || '$',
        primary_color: siteConfig.primary_color || '#6366f1',
        allow_registration: siteConfig.allow_registration !== false
      });
      setLoading(false);
    }
  }, [siteConfig]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await adminService.updateSiteConfig(config);
    setSaving(false);

    if (result.success) {
      showSuccess('Configuración guardada');
      loadSiteConfig();
    } else {
      showError('Error al guardar configuración');
    }
  };

  const handleReset = () => {
    if (window.confirm('¿Restablecer a valores por defecto?')) {
      setConfig({
        site_name: 'DebtTracker',
        currency: '$',
        primary_color: '#6366f1',
        allow_registration: true
      });
    }
  };

  if (loading) {
    return <Loading size="lg" text="Cargando configuración..." />;
  }

  return (
    <div className={styles.adminConfig}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Configuración del Sitio</h2>
          <p className={styles.subtitle}>Personaliza la apariencia y comportamiento</p>
        </div>
      </div>

      <div className={styles.content}>
        {/* General */}
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>⚙️ General</h3>
          
          <div className={styles.form}>
            <Input
              label="Nombre del Sitio"
              name="site_name"
              value={config.site_name}
              onChange={handleChange}
              placeholder="Nombre de la aplicación"
            />

            <Select
              label="Moneda"
              name="currency"
              value={config.currency}
              onChange={handleChange}
              options={[
                { value: '$', label: '$ - Peso/Dólar' },
                { value: '€', label: '€ - Euro' },
                { value: 'US$', label: 'US$ - Dólar Estadounidense' },
                { value: 'AR$', label: 'AR$ - Peso Argentino' },
                { value: 'CL$', label: 'CL$ - Peso Chileno' },
                { value: 'MX$', label: 'MX$ - Peso Mexicano' },
                { value: 'R$', label: 'R$ - Real Brasileño' },
                { value: '£', label: '£ - Libra Esterlina' }
              ]}
            />
          </div>
        </Card>

        {/* Apariencia */}
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>🎨 Apariencia</h3>
          
          <div className={styles.form}>
            <div className={styles.colorPicker}>
              <label className={styles.label}>Color Principal</label>
              <div className={styles.colorRow}>
                <input
                  type="color"
                  name="primary_color"
                  value={config.primary_color}
                  onChange={handleChange}
                  className={styles.colorInput}
                />
                <Input
                  value={config.primary_color}
                  onChange={handleChange}
                  name="primary_color"
                  placeholder="#6366f1"
                />
              </div>
              <p className={styles.hint}>
                Este color se usará para botones, enlaces y acentos
              </p>
            </div>

            <div className={styles.presetColors}>
              <span className={styles.label}>Colores Predefinidos:</span>
              <div className={styles.presets}>
                {['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#22c55e', '#14b8a6', '#0ea5e9'].map(color => (
                  <button
                    key={color}
                    className={`${styles.presetBtn} ${config.primary_color === color ? styles.active : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setConfig(prev => ({ ...prev, primary_color: color }))}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Seguridad */}
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>🔐 Seguridad</h3>
          
          <div className={styles.form}>
            <div className={styles.toggleItem}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>Permitir Registros</span>
                <span className={styles.toggleHint}>
                  Cuando está desactivado, solo los administradores pueden crear usuarios
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  name="allow_registration"
                  checked={config.allow_registration}
                  onChange={handleChange}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>
        </Card>

        {/* Preview */}
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>👁️ Vista Previa</h3>
          
          <div className={styles.preview}>
            <div 
              className={styles.previewHeader}
              style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${config.primary_color}dd)` }}
            >
              <span className={styles.previewLogo}>💰</span>
              <span className={styles.previewName}>{config.site_name}</span>
            </div>
            <div className={styles.previewContent}>
              <button 
                className={styles.previewBtn}
                style={{ background: config.primary_color }}
              >
                Botón de ejemplo
              </button>
              <p>Moneda: <strong>{config.currency}1,234.56</strong></p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={handleReset}>
            Restablecer
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminConfig;
