/**
 * Friends Context - Manejo global de amigos
 * Versión ultra-simplificada
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import friendsService from '../services/friendsService';

const FriendsContext = createContext(null);

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends debe usarse dentro de FriendsProvider');
  }
  return context;
};

export const FriendsProvider = ({ children }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadingRef = useRef(false);
  const userIdRef = useRef(null);

  const loadFriends = async (forceUserId = null) => {
    const userId = forceUserId || user?.id;
    if (!userId || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      const [friendsResult, pendingResult, sentResult] = await Promise.all([
        friendsService.getFriends(userId),
        friendsService.getPendingRequests(userId),
        friendsService.getSentRequests(userId)
      ]);

      setFriends(friendsResult.friends || []);
      setPendingRequests(pendingResult.requests || []);
      setSentRequests(sentResult.requests || []);
      setError(null);
    } catch (err) {
      console.error('Error cargando amigos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (user?.id && user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      loadFriends(user.id);
    } else if (!user?.id) {
      userIdRef.current = null;
      setFriends([]);
      setPendingRequests([]);
      setSentRequests([]);
    }
  }, [user?.id]);

  const searchUsers = async (nickname) => {
    try {
      const result = await friendsService.searchUserByNickname(nickname);
      const filtered = (result.users || []).filter(u => {
        if (u.id === user?.id) return false;
        if (friends.some(f => f.friend?.id === u.id)) return false;
        return true;
      });
      return { users: filtered, error: result.error };
    } catch (err) {
      return { users: [], error: err };
    }
  };

  const sendRequest = async (nickname) => {
    if (!user) return { success: false };
    
    try {
      const result = await friendsService.sendFriendRequest(user.id, nickname);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadFriends(user.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const acceptRequest = async (friendshipId) => {
    try {
      const result = await friendsService.acceptFriendRequest(friendshipId);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadFriends(user?.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const rejectRequest = async (friendshipId) => {
    try {
      const result = await friendsService.rejectFriendRequest(friendshipId);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadFriends(user?.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const removeFriend = async (friendshipId) => {
    try {
      const result = await friendsService.removeFriend(friendshipId);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadFriends(user?.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const value = {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    error,
    pendingCount: pendingRequests.length,
    searchUsers,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    refreshFriends: () => { loadingRef.current = false; loadFriends(user?.id); }
  };

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
};

export default FriendsContext;
