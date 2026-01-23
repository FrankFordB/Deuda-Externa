/**
 * Avatar Component - Avatar de usuario reutilizable
 */
import styles from './Avatar.module.css';

const Avatar = ({ 
  src, 
  firstName, 
  lastName, 
  nickname,
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className = '',
  onClick
}) => {
  // Obtener iniciales
  const getInitials = () => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.slice(0, 2).toUpperCase();
    }
    if (nickname) {
      return nickname.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  // Generar color basado en el nombre
  const getColor = () => {
    const name = firstName || nickname || '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', 
      '#f59e0b', '#22c55e', '#14b8a6', '#6366f1'
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div 
      className={`${styles.avatar} ${styles[size]} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
      style={!src ? { backgroundColor: getColor() } : undefined}
    >
      {src ? (
        <img 
          src={src} 
          alt={`${firstName || nickname || 'Usuario'}`} 
          className={styles.image}
        />
      ) : (
        <span className={styles.initials}>{getInitials()}</span>
      )}
    </div>
  );
};

export default Avatar;
