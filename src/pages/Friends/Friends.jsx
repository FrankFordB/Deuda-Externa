/**
 * Friends Page - Gestión de amigos (reales y virtuales)
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useFriends, useUI, useAuth } from '../../context';
import { Button, Card, Input, Modal, Loading, EmptyState } from '../../components';
import virtualFriendsService from '../../services/virtualFriendsService';
import styles from './Friends.module.css';

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
    return <Loading size="lg" text="Cargando amigos..." />;
  }

  const totalFriends = friends.length + virtualFriends.length;

  return (
    <div className={styles.friends}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Amigos</h2>
          <p className={styles.subtitle}>
            {totalFriends} amigo{totalFriends !== 1 ? 's' : ''} ({friends.length} reales, {virtualFriends.length} ficticios)
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button icon="➕" onClick={() => openModal('search')}>
            Agregar Amigo
          </Button>
          <Button icon="👻" variant="secondary" onClick={() => openModal('virtual')}>
            Persona Ficticia
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
          onClick={() => setActiveTab('all')}
        >
          📋 Todos ({totalFriends})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'friends' ? styles.active : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          👥 Reales ({friends.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'virtual' ? styles.active : ''}`}
          onClick={() => setActiveTab('virtual')}
        >
          👻 Ficticios ({virtualFriends.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'pending' ? styles.active : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          📥 Solicitudes
          {pendingRequests.length > 0 && (
            <span className={styles.tabBadge}>{pendingRequests.length}</span>
          )}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'sent' ? styles.active : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          📤 Enviadas ({sentRequests.length})
        </button>
      </div>

      {/* Content */}
      <Card>
        {/* Vista TODOS - Lista profesional */}
        {activeTab === 'all' && (
          totalFriends > 0 ? (
            <div className={styles.allFriendsList}>
              {friends.map(({ friendshipId, friend, since }) => (
                <div key={friendshipId} className={styles.friendListItem}>
                  <div className={styles.friendListAvatar}>
                    {friend.first_name?.[0]}{friend.last_name?.[0]}
                  </div>
                  <div className={styles.friendListInfo}>
                    <div className={styles.friendListName}>
                      {friend.first_name} {friend.last_name}
                      <span className={styles.typeBadge}>Usuario</span>
                    </div>
                    <div className={styles.friendListDetails}>
                      <span>@{friend.nickname}</span>
                      {friend.country && <span>📍 {friend.country}</span>}
                      {since && <span>📅 {new Date(since).toLocaleDateString('es-AR')}</span>}
                    </div>
                  </div>
                  <div className={styles.friendListActions}>
                    <Button size="sm" variant="danger" onClick={() => handleRemove(friendshipId)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
              {virtualFriends.map((friend) => (
                <div key={friend.id} className={styles.friendListItem}>
                  <div className={`${styles.friendListAvatar} ${styles.virtualAvatar}`}>
                    {friend.name?.[0]?.toUpperCase()}
                  </div>
                  <div className={styles.friendListInfo}>
                    <div className={styles.friendListName}>
                      {friend.name}
                      <span className={`${styles.typeBadge} ${styles.virtualType}`}>Ficticio</span>
                    </div>
                    <div className={styles.friendListDetails}>
                      {friend.phone && <span>📱 {friend.phone}</span>}
                      {friend.email && <span>📧 {friend.email}</span>}
                      {friend.notes && <span>📝 {friend.notes}</span>}
                    </div>
                  </div>
                  <div className={styles.friendListActions}>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteVirtualFriend(friend.id)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="👥"
              title="Sin amigos"
              description="Agrega amigos reales o ficticios para empezar"
              action="Agregar amigo"
              onAction={() => openModal('search')}
            />
          )
        )}

        {activeTab === 'friends' && (
          friends.length > 0 ? (
            <div className={styles.friendsList}>
              {friends.map(({ friendshipId, friend, since }) => (
                <div key={friendshipId} className={styles.friendItem}>
                  <div className={styles.friendInfo}>
                    <div className={styles.friendAvatar}>
                      {friend.first_name?.[0]}{friend.last_name?.[0]}
                    </div>
                    <div>
                      <div className={styles.friendName}>
                        {friend.first_name} {friend.last_name}
                      </div>
                      <div className={styles.friendNickname}>@{friend.nickname}</div>
                      <div className={styles.friendMeta}>
                        {friend.country && <span>📍 {friend.country}</span>}
                        {since && (
                          <span>
                            Amigos desde {new Date(since).toLocaleDateString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.friendActions}>
                    <Button 
                      size="sm" 
                      variant="danger"
                      onClick={() => handleRemove(friendshipId)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="👥"
              title="Sin amigos reales"
              description="Agrega amigos usando su nickname para compartir gastos y deudas"
              action="Agregar amigo"
              onAction={() => openModal('search')}
            />
          )
        )}

        {activeTab === 'virtual' && (
          virtualFriends.length > 0 ? (
            <div className={styles.friendsList}>
              {virtualFriends.map((friend) => (
                <div key={friend.id} className={styles.friendItem}>
                  <div className={styles.friendInfo}>
                    <div className={`${styles.friendAvatar} ${styles.virtual}`}>
                      {friend.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.friendName}>
                        {friend.name}
                        <span className={styles.virtualBadge}>Contacto personal</span>
                      </div>
                      {friend.email && <div className={styles.friendNickname}>📧 {friend.email}</div>}
                      {friend.phone && <div className={styles.friendNickname}>📱 {friend.phone}</div>}
                      {friend.notes && <div className={styles.friendMeta}>{friend.notes}</div>}
                    </div>
                  </div>
                  <div className={styles.friendActions}>
                    <Button 
                      size="sm" 
                      variant="danger"
                      onClick={() => handleDeleteVirtualFriend(friend.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="👤"
              title="Sin contactos personales"
              description="Agrega personas que no usan la app para organizar tus deudas con ellos"
              action="Agregar contacto"
              onAction={() => openModal('virtual')}
            />
          )
        )}

        {activeTab === 'pending' && (
          pendingRequests.length > 0 ? (
            <div className={styles.friendsList}>
              {pendingRequests.map((request) => (
                <div key={request.id} className={styles.friendItem}>
                  <div className={styles.friendInfo}>
                    <div className={styles.friendAvatar}>
                      {request.user?.first_name?.[0]}{request.user?.last_name?.[0]}
                    </div>
                    <div>
                      <div className={styles.friendName}>
                        {request.user?.first_name} {request.user?.last_name}
                      </div>
                      <div className={styles.friendNickname}>@{request.user?.nickname}</div>
                      <div className={styles.friendMeta}>
                        Recibida el {new Date(request.created_at).toLocaleDateString('es-AR')}
                      </div>
                    </div>
                  </div>
                  <div className={styles.friendActions}>
                    <Button 
                      size="sm" 
                      variant="success"
                      onClick={() => handleAccept(request.id)}
                    >
                      Aceptar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="danger"
                      onClick={() => handleReject(request.id)}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📭"
              title="Sin solicitudes"
              description="No tienes solicitudes de amistad pendientes"
            />
          )
        )}

        {activeTab === 'sent' && (
          sentRequests.length > 0 ? (
            <div className={styles.friendsList}>
              {sentRequests.map((request) => (
                <div key={request.id} className={styles.friendItem}>
                  <div className={styles.friendInfo}>
                    <div className={styles.friendAvatar}>
                      {request.friend?.first_name?.[0]}{request.friend?.last_name?.[0]}
                    </div>
                    <div>
                      <div className={styles.friendName}>
                        {request.friend?.first_name} {request.friend?.last_name}
                      </div>
                      <div className={styles.friendNickname}>@{request.friend?.nickname}</div>
                      <div className={styles.friendMeta}>
                        Enviada el {new Date(request.created_at).toLocaleDateString('es-AR')}
                      </div>
                    </div>
                  </div>
                  <div className={styles.friendStatus}>
                    <span className={styles.pendingBadge}>⏳ Pendiente</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📤"
              title="Sin solicitudes enviadas"
              description="No tienes solicitudes de amistad pendientes de respuesta"
            />
          )
        )}
      </Card>

      {/* Modal de agregar amigo */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={modalType === 'search' ? 'Agregar Amigo' : 'Agregar Contacto Personal'}
        size="md"
      >
        {modalType === 'search' ? (
          <div className={styles.searchSection}>
            <p className={styles.searchHint}>
              Busca a tu amigo por su <strong>nickname</strong>. 
              El nickname es único y lo pueden ver en su panel de perfil.
            </p>
            
            <div className={styles.searchBar}>
              <Input
                placeholder="Buscar por nickname..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                icon="🔍"
              />
              <Button onClick={handleSearch} loading={searchLoading}>
                Buscar
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((user) => (
                  <div key={user.id} className={styles.searchItem}>
                    <div className={styles.searchInfo}>
                      <div className={styles.friendAvatar}>
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <div className={styles.friendName}>
                          {user.first_name} {user.last_name}
                        </div>
                        <div className={styles.friendNickname}>@{user.nickname}</div>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => handleSendRequest(user.nickname)}
                      loading={requestLoading}
                    >
                      Agregar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !searchLoading && (
              <div className={styles.noResults}>
                No se encontraron usuarios con ese nickname
              </div>
            )}

            <div className={styles.modalDivider}>
              <span>¿Tu contacto no usa la app?</span>
            </div>
            <Button 
              variant="secondary" 
              icon="👤"
              onClick={() => setModalType('virtual')}
              style={{ width: '100%' }}
            >
              Agregar como contacto personal (ficticio)
            </Button>
          </div>
        ) : (
          <div className={styles.virtualForm}>
            <p className={styles.searchHint}>
              Agrega un contacto personal que <strong>no usa la app</strong>. 
              Podrás registrar deudas con esta persona, pero no recibirán notificaciones.
            </p>
            
            <Input
              label="Nombre *"
              placeholder="Nombre del contacto"
              value={newVirtualFriend.name}
              onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, name: e.target.value }))}
            />
            <Input
              label="Email (opcional)"
              type="email"
              placeholder="email@ejemplo.com"
              value={newVirtualFriend.email}
              onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, email: e.target.value }))}
            />
            <Input
              label="Teléfono (opcional)"
              placeholder="+54 9 11 1234-5678"
              value={newVirtualFriend.phone}
              onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, phone: e.target.value }))}
            />
            <Input
              label="Notas (opcional)"
              placeholder="Ej: Compañero de trabajo"
              value={newVirtualFriend.notes}
              onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, notes: e.target.value }))}
            />
            
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setModalType('search')}>
                Volver
              </Button>
              <Button 
                onClick={handleCreateVirtualFriend} 
                loading={requestLoading}
              >
                Agregar Contacto
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Friends;
