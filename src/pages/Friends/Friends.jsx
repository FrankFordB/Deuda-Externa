/**
 * Friends Page - Gestión de amigos (reales y virtuales)
 * Professional Redesign with Friendly Colors
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useFriends, useUI, useAuth } from '../../context';
import { Button, Card, Input, Modal, Loading, EmptyState } from '../../components';
import virtualFriendsService from '../../services/virtualFriendsService';
import { 
  Users, UserPlus, Ghost, LayoutList, UserCheck, Inbox, 
  Send, Search, MapPin, Calendar, Mail, Phone, FileText,
  Trash2, Check, X, Clock, UserCircle, Heart, ArrowLeft
} from 'lucide-react';
import './Friends.css';

const Friends = () => {
  const { 
    friends, 
    pendingRequests, 
    sentRequests,
    loading,
    searchUsers,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend
  } = useFriends();
  const { showSuccess, showError } = useUI();
  const { user } = useAuth();
  const location = useLocation();

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('search'); // 'search' | 'virtual'
  const [searchLoading, setSearchLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  
  // Estado para amigos virtuales
  const [virtualFriends, setVirtualFriends] = useState([]);
  const [virtualLoading, setVirtualLoading] = useState(false);
  const [newVirtualFriend, setNewVirtualFriend] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });

  // Cargar amigos virtuales
  useEffect(() => {
    const loadVirtualFriends = async () => {
      if (!user) return;
      setVirtualLoading(true);
      const result = await virtualFriendsService.getVirtualFriends(user.id);
      if (!result.error) {
        setVirtualFriends(result.friends || []);
      }
      setVirtualLoading(false);
    };
    loadVirtualFriends();
  }, [user]);

  // Abrir modal si viene desde navegación
  useEffect(() => {
    if (location.state?.openNew) {
      setShowModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    const result = await searchUsers(searchQuery);
    setSearchResults(result.users || []);
    setSearchLoading(false);
  };

  const handleSendRequest = async (nickname) => {
    setRequestLoading(true);
    const result = await sendRequest(nickname);
    setRequestLoading(false);

    if (result.success) {
      showSuccess('Solicitud enviada');
      setSearchResults(prev => prev.filter(u => u.nickname !== nickname));
    } else {
      showError(result.error?.message || 'Error al enviar solicitud');
    }
  };

  const handleAccept = async (friendshipId) => {
    const result = await acceptRequest(friendshipId);
    if (result.success) {
      showSuccess('Solicitud aceptada');
    } else {
      showError('Error al aceptar solicitud');
    }
  };

  const handleReject = async (friendshipId) => {
    const result = await rejectRequest(friendshipId);
    if (result.success) {
      showSuccess('Solicitud rechazada');
    } else {
      showError('Error al rechazar solicitud');
    }
  };

  const handleRemove = async (friendshipId) => {
    if (window.confirm('¿Estás seguro de eliminar este amigo?')) {
      const result = await removeFriend(friendshipId);
      if (result.success) {
        showSuccess('Amigo eliminado');
      } else {
        showError('Error al eliminar amigo');
      }
    }
  };

  const handleCreateVirtualFriend = async () => {
    if (!newVirtualFriend.name.trim()) {
      showError('El nombre es obligatorio');
      return;
    }

    setRequestLoading(true);
    const result = await virtualFriendsService.createVirtualFriend(user.id, newVirtualFriend);
    setRequestLoading(false);

    if (!result.error) {
      setVirtualFriends(prev => [...prev, result.friend]);
      setNewVirtualFriend({ name: '', email: '', phone: '', notes: '' });
      showSuccess('Amigo agregado correctamente');
      setShowModal(false);
    } else {
      showError('Error al crear amigo');
    }
  };

  const handleDeleteVirtualFriend = async (friendId) => {
    if (window.confirm('¿Estás seguro de eliminar este amigo?')) {
      const result = await virtualFriendsService.deleteVirtualFriend(friendId);
      if (!result.error) {
        setVirtualFriends(prev => prev.filter(f => f.id !== friendId));
        showSuccess('Amigo eliminado');
      } else {
        showError('Error al eliminar amigo');
      }
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSearchQuery('');
    setSearchResults([]);
    setNewVirtualFriend({ name: '', email: '', phone: '', notes: '' });
  };

  if (loading || virtualLoading) {
    return (
      <div className="friends-loading">
        <div className="friends-loading-spinner"></div>
        <span className="friends-loading-text">Cargando amigos...</span>
      </div>
    );
  }

  const totalFriends = friends.length + virtualFriends.length;

  return (
    <div className="friends-page">
      {/* Header */}
      <header className="friends-header">
        <div className="friends-header-content">
          <div className="friends-header-left">
            <div className="friends-header-icon">
              <Heart size={40} />
            </div>
            <h1 className="friends-title">
              Mis Amigos
            </h1>
            <p className="friends-subtitle">
              <Users size={18} />
              {totalFriends} amigo{totalFriends !== 1 ? 's' : ''} en total
            </p>
            <div className="friends-header-stats">
              <span className="friends-stat-item">
                <UserCheck size={16} />
                {friends.length} reales
              </span>
              <span className="friends-stat-item">
                <Ghost size={16} />
                {virtualFriends.length} ficticios
              </span>
            </div>
          </div>
          <div className="friends-header-actions">
            <button className="friends-btn-add" onClick={() => openModal('search')}>
              <UserPlus size={18} />
              Agregar Amigo
            </button>
            <button className="friends-btn-virtual" onClick={() => openModal('virtual')}>
              <Ghost size={18} />
              Persona Ficticia
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="friends-tabs-container">
        <div className="friends-tabs">
          <button 
            className={`friends-tab ${activeTab === 'all' ? 'friends-tab-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <LayoutList size={18} />
            Todos ({totalFriends})
          </button>
          <button 
            className={`friends-tab ${activeTab === 'friends' ? 'friends-tab-active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            <Users size={18} />
            Reales ({friends.length})
          </button>
          <button 
            className={`friends-tab ${activeTab === 'virtual' ? 'friends-tab-active' : ''}`}
            onClick={() => setActiveTab('virtual')}
          >
            <Ghost size={18} />
            Ficticios ({virtualFriends.length})
          </button>
          <button 
            className={`friends-tab ${activeTab === 'pending' ? 'friends-tab-active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <Inbox size={18} />
            Solicitudes
            {pendingRequests.length > 0 && (
              <span className="friends-tab-badge">{pendingRequests.length}</span>
            )}
          </button>
          <button 
            className={`friends-tab ${activeTab === 'sent' ? 'friends-tab-active' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            <Send size={18} />
            Enviadas ({sentRequests.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="friends-content-card">
        {/* Vista TODOS */}
        {activeTab === 'all' && (
          totalFriends > 0 ? (
            <div className="friends-list">
              {friends.map(({ friendshipId, friend, since }) => (
                <div key={friendshipId} className="friends-list-item">
                  <div className="friends-avatar">
                    {friend.first_name?.[0]}{friend.last_name?.[0]}
                  </div>
                  <div className="friends-info">
                    <div className="friends-name">
                      {friend.first_name} {friend.last_name}
                      <span className="friends-badge friends-badge-real">Usuario</span>
                    </div>
                    <div className="friends-nickname">@{friend.nickname}</div>
                    <div className="friends-meta">
                      {friend.country && (
                        <span className="friends-meta-item">
                          <MapPin size={14} />
                          {friend.country}
                        </span>
                      )}
                      {since && (
                        <span className="friends-meta-item">
                          <Calendar size={14} />
                          {new Date(since).toLocaleDateString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="friends-actions">
                    <button className="friends-btn friends-btn-danger" onClick={() => handleRemove(friendshipId)}>
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {virtualFriends.map((friend) => (
                <div key={friend.id} className="friends-list-item">
                  <div className="friends-avatar friends-avatar-virtual">
                    {friend.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="friends-info">
                    <div className="friends-name">
                      {friend.name}
                      <span className="friends-badge friends-badge-virtual">Ficticio</span>
                    </div>
                    <div className="friends-meta">
                      {friend.phone && (
                        <span className="friends-meta-item">
                          <Phone size={14} />
                          {friend.phone}
                        </span>
                      )}
                      {friend.email && (
                        <span className="friends-meta-item">
                          <Mail size={14} />
                          {friend.email}
                        </span>
                      )}
                      {friend.notes && (
                        <span className="friends-meta-item">
                          <FileText size={14} />
                          {friend.notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="friends-actions">
                    <button className="friends-btn friends-btn-danger" onClick={() => handleDeleteVirtualFriend(friend.id)}>
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="friends-empty">
              <div className="friends-empty-icon">👥</div>
              <h3 className="friends-empty-title">Sin amigos</h3>
              <p className="friends-empty-text">Agrega amigos reales o ficticios para empezar a organizar tus deudas</p>
              <button className="friends-empty-action" onClick={() => openModal('search')}>
                <UserPlus size={18} />
                Agregar amigo
              </button>
            </div>
          )
        )}

        {/* Vista REALES */}
        {activeTab === 'friends' && (
          friends.length > 0 ? (
            <div className="friends-list">
              {friends.map(({ friendshipId, friend, since }) => (
                <div key={friendshipId} className="friends-list-item">
                  <div className="friends-avatar">
                    {friend.first_name?.[0]}{friend.last_name?.[0]}
                  </div>
                  <div className="friends-info">
                    <div className="friends-name">
                      {friend.first_name} {friend.last_name}
                    </div>
                    <div className="friends-nickname">@{friend.nickname}</div>
                    <div className="friends-meta">
                      {friend.country && (
                        <span className="friends-meta-item">
                          <MapPin size={14} />
                          {friend.country}
                        </span>
                      )}
                      {since && (
                        <span className="friends-meta-item">
                          <Calendar size={14} />
                          Amigos desde {new Date(since).toLocaleDateString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="friends-actions">
                    <button className="friends-btn friends-btn-danger" onClick={() => handleRemove(friendshipId)}>
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="friends-empty">
              <div className="friends-empty-icon">👥</div>
              <h3 className="friends-empty-title">Sin amigos reales</h3>
              <p className="friends-empty-text">Agrega amigos usando su nickname para compartir gastos y deudas</p>
              <button className="friends-empty-action" onClick={() => openModal('search')}>
                <UserPlus size={18} />
                Agregar amigo
              </button>
            </div>
          )
        )}

        {/* Vista FICTICIOS */}
        {activeTab === 'virtual' && (
          virtualFriends.length > 0 ? (
            <div className="friends-list">
              {virtualFriends.map((friend) => (
                <div key={friend.id} className="friends-list-item">
                  <div className="friends-avatar friends-avatar-virtual">
                    {friend.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="friends-info">
                    <div className="friends-name">
                      {friend.name}
                      <span className="friends-badge friends-badge-virtual">Contacto personal</span>
                    </div>
                    <div className="friends-meta">
                      {friend.email && (
                        <span className="friends-meta-item">
                          <Mail size={14} />
                          {friend.email}
                        </span>
                      )}
                      {friend.phone && (
                        <span className="friends-meta-item">
                          <Phone size={14} />
                          {friend.phone}
                        </span>
                      )}
                      {friend.notes && (
                        <span className="friends-meta-item">
                          <FileText size={14} />
                          {friend.notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="friends-actions">
                    <button className="friends-btn friends-btn-danger" onClick={() => handleDeleteVirtualFriend(friend.id)}>
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="friends-empty">
              <div className="friends-empty-icon">👤</div>
              <h3 className="friends-empty-title">Sin contactos personales</h3>
              <p className="friends-empty-text">Agrega personas que no usan la app para organizar tus deudas con ellos</p>
              <button className="friends-empty-action" onClick={() => openModal('virtual')}>
                <Ghost size={18} />
                Agregar contacto
              </button>
            </div>
          )
        )}

        {/* Vista SOLICITUDES PENDIENTES */}
        {activeTab === 'pending' && (
          pendingRequests.length > 0 ? (
            <div className="friends-list">
              {pendingRequests.map((request) => (
                <div key={request.id} className="friends-list-item">
                  <div className="friends-avatar friends-avatar-accent">
                    {request.user?.first_name?.[0]}{request.user?.last_name?.[0]}
                  </div>
                  <div className="friends-info">
                    <div className="friends-name">
                      {request.user?.first_name} {request.user?.last_name}
                    </div>
                    <div className="friends-nickname">@{request.user?.nickname}</div>
                    <div className="friends-meta">
                      <span className="friends-meta-item">
                        <Calendar size={14} />
                        Recibida el {new Date(request.created_at).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  </div>
                  <div className="friends-actions">
                    <button className="friends-btn friends-btn-success" onClick={() => handleAccept(request.id)}>
                      <Check size={16} />
                      Aceptar
                    </button>
                    <button className="friends-btn friends-btn-danger" onClick={() => handleReject(request.id)}>
                      <X size={16} />
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="friends-empty">
              <div className="friends-empty-icon">📭</div>
              <h3 className="friends-empty-title">Sin solicitudes</h3>
              <p className="friends-empty-text">No tienes solicitudes de amistad pendientes</p>
            </div>
          )
        )}

        {/* Vista ENVIADAS */}
        {activeTab === 'sent' && (
          sentRequests.length > 0 ? (
            <div className="friends-list">
              {sentRequests.map((request) => (
                <div key={request.id} className="friends-list-item">
                  <div className="friends-avatar">
                    {request.friend?.first_name?.[0]}{request.friend?.last_name?.[0]}
                  </div>
                  <div className="friends-info">
                    <div className="friends-name">
                      {request.friend?.first_name} {request.friend?.last_name}
                    </div>
                    <div className="friends-nickname">@{request.friend?.nickname}</div>
                    <div className="friends-meta">
                      <span className="friends-meta-item">
                        <Calendar size={14} />
                        Enviada el {new Date(request.created_at).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  </div>
                  <div className="friends-status">
                    <span className="friends-status-pending">
                      <Clock size={16} />
                      Pendiente
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="friends-empty">
              <div className="friends-empty-icon">📤</div>
              <h3 className="friends-empty-title">Sin solicitudes enviadas</h3>
              <p className="friends-empty-text">No tienes solicitudes de amistad pendientes de respuesta</p>
            </div>
          )
        )}
      </div>

      {/* Modal de agregar amigo */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={modalType === 'search' ? 'Agregar Amigo' : 'Agregar Contacto Personal'}
        size="md"
      >
        {modalType === 'search' ? (
          <div className="friends-modal-section">
            <p className="friends-modal-hint">
              Busca a tu amigo por su <strong>nickname</strong>. 
              El nickname es único y lo pueden ver en su panel de perfil.
            </p>
            
            <div className="friends-search-bar">
              <div className="friends-search-input-wrapper">
                <Search size={18} />
                <input
                  className="friends-search-input"
                  placeholder="Buscar por nickname..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button className="friends-search-btn" onClick={handleSearch} disabled={searchLoading}>
                {searchLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="friends-search-results">
                {searchResults.map((user) => (
                  <div key={user.id} className="friends-search-item">
                    <div className="friends-search-info">
                      <div className="friends-search-avatar">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <div className="friends-search-name">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="friends-search-nickname">@{user.nickname}</div>
                      </div>
                    </div>
                    <button 
                      className="friends-btn friends-btn-primary"
                      onClick={() => handleSendRequest(user.nickname)}
                      disabled={requestLoading}
                    >
                      <UserPlus size={16} />
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !searchLoading && (
              <div className="friends-no-results">
                <UserCircle size={48} />
                <p>No se encontraron usuarios con ese nickname</p>
              </div>
            )}

            <div className="friends-modal-divider">
              <span>¿Tu contacto no usa la app?</span>
            </div>
            <button 
              className="friends-virtual-option"
              onClick={() => setModalType('virtual')}
            >
              <Ghost size={18} />
              Agregar como contacto personal (ficticio)
            </button>
          </div>
        ) : (
          <div className="friends-modal-section">
            <p className="friends-modal-hint">
              Agrega un contacto personal que <strong>no usa la app</strong>. 
              Podrás registrar deudas con esta persona, pero no recibirán notificaciones.
            </p>
            
            <div className="friends-form">
              <div className="friends-form-group">
                <label className="friends-form-label friends-form-label-required">Nombre</label>
                <input
                  className="friends-form-input"
                  placeholder="Nombre del contacto"
                  value={newVirtualFriend.name}
                  onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="friends-form-group">
                <label className="friends-form-label">Email (opcional)</label>
                <input
                  className="friends-form-input"
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={newVirtualFriend.email}
                  onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="friends-form-group">
                <label className="friends-form-label">Teléfono (opcional)</label>
                <input
                  className="friends-form-input"
                  placeholder="+54 9 11 1234-5678"
                  value={newVirtualFriend.phone}
                  onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="friends-form-group">
                <label className="friends-form-label">Notas (opcional)</label>
                <input
                  className="friends-form-input"
                  placeholder="Ej: Compañero de trabajo"
                  value={newVirtualFriend.notes}
                  onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="friends-modal-actions">
              <button className="friends-btn-secondary" onClick={() => setModalType('search')}>
                <ArrowLeft size={18} />
                Volver
              </button>
              <button 
                className="friends-btn-submit"
                onClick={handleCreateVirtualFriend} 
                disabled={requestLoading}
              >
                <UserPlus size={18} />
                {requestLoading ? 'Agregando...' : 'Agregar Contacto'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Friends;
