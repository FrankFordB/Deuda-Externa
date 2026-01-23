/**
 * Shared Expenses Service - Sistema de gastos compartidos tipo Splitwise
 */
import { supabase } from './supabase';

// ==========================================
// GRUPOS
// ==========================================

/**
 * Obtener todos los grupos del usuario
 */
export const getUserGroups = async (userId) => {
  try {
    // Obtener grupos donde el usuario es miembro activo
    const { data: memberGroups, error: memberError } = await supabase
      .from('expense_group_members')
      .select(`
        group_id,
        role,
        balance,
        expense_groups (
          id,
          name,
          description,
          category,
          icon,
          created_by,
          is_active,
          total_spent,
          currency,
          currency_symbol,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (memberError) throw memberError;

    // Mapear los grupos con la info del miembro
    const groups = memberGroups
      ?.filter(m => m.expense_groups?.is_active)
      .map(m => ({
        ...m.expense_groups,
        userRole: m.role,
        userBalance: m.balance
      })) || [];

    return { groups, error: null };
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    return { groups: [], error: error.message };
  }
};

/**
 * Obtener un grupo con todos sus detalles
 */
export const getGroupDetails = async (groupId) => {
  try {
    const { data: group, error: groupError } = await supabase
      .from('expense_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError) throw groupError;

    // Obtener miembros
    const { data: members, error: membersError } = await supabase
      .from('expense_group_members')
      .select(`
        id,
        user_id,
        virtual_friend_id,
        display_name,
        role,
        balance,
        joined_at,
        is_active,
        profiles:user_id (
          id,
          first_name,
          last_name,
          nickname,
          email,
          avatar_url
        ),
        virtual_friends:virtual_friend_id (
          id,
          name,
          email
        )
      `)
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (membersError) throw membersError;

    // Formatear miembros
    const formattedMembers = members.map(m => ({
      id: m.id,
      userId: m.user_id,
      virtualFriendId: m.virtual_friend_id,
      displayName: m.display_name || 
        (m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : m.virtual_friends?.name),
      nickname: m.profiles?.nickname,
      email: m.profiles?.email || m.virtual_friends?.email,
      avatarUrl: m.profiles?.avatar_url,
      role: m.role,
      balance: parseFloat(m.balance) || 0,
      joinedAt: m.joined_at,
      isVirtual: m.virtual_friend_id !== null,
      profile: m.profiles,
      virtualFriend: m.virtual_friends
    }));

    return { 
      group: { ...group, members: formattedMembers }, 
      error: null 
    };
  } catch (error) {
    console.error('Error obteniendo detalles del grupo:', error);
    return { group: null, error: error.message };
  }
};

/**
 * Crear un nuevo grupo
 */
export const createGroup = async (userId, groupData) => {
  try {
    // Crear el grupo
    const { data: group, error: groupError } = await supabase
      .from('expense_groups')
      .insert({
        name: groupData.name,
        description: groupData.description || null,
        category: groupData.category || 'general',
        icon: groupData.icon || 'users',
        created_by: userId,
        currency: groupData.currency || 'ARS',
        currency_symbol: groupData.currency_symbol || '$'
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // Agregar al creador como admin
    const { error: memberError } = await supabase
      .from('expense_group_members')
      .insert({
        group_id: group.id,
        user_id: userId,
        role: 'admin'
      });

    if (memberError) throw memberError;

    return { group, error: null };
  } catch (error) {
    console.error('Error creando grupo:', error);
    return { group: null, error: error.message };
  }
};

/**
 * Actualizar un grupo
 */
export const updateGroup = async (groupId, updates) => {
  try {
    const { data, error } = await supabase
      .from('expense_groups')
      .update({
        name: updates.name,
        description: updates.description,
        category: updates.category,
        icon: updates.icon,
        currency: updates.currency,
        currency_symbol: updates.currency_symbol,
        updated_at: new Date().toISOString()
      })
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;
    return { group: data, error: null };
  } catch (error) {
    console.error('Error actualizando grupo:', error);
    return { group: null, error: error.message };
  }
};

/**
 * Eliminar (desactivar) un grupo
 */
export const deleteGroup = async (groupId) => {
  try {
    const { error } = await supabase
      .from('expense_groups')
      .update({ is_active: false })
      .eq('id', groupId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando grupo:', error);
    return { error: error.message };
  }
};

// ==========================================
// MIEMBROS
// ==========================================

/**
 * Agregar un miembro al grupo (usuario real)
 */
export const addMember = async (groupId, userId) => {
  try {
    // Verificar si ya es miembro
    const { data: existing } = await supabase
      .from('expense_group_members')
      .select('id, is_active')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      if (existing.is_active) {
        return { member: null, error: 'El usuario ya es miembro del grupo' };
      }
      // Reactivar miembro
      const { data, error } = await supabase
        .from('expense_group_members')
        .update({ is_active: true })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return { member: data, error: null };
    }

    const { data, error } = await supabase
      .from('expense_group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
        role: 'member'
      })
      .select()
      .single();

    if (error) throw error;
    return { member: data, error: null };
  } catch (error) {
    console.error('Error agregando miembro:', error);
    return { member: null, error: error.message };
  }
};

/**
 * Agregar un amigo virtual al grupo
 */
export const addVirtualMember = async (groupId, virtualFriendId, displayName) => {
  try {
    // Verificar si ya es miembro
    const { data: existing } = await supabase
      .from('expense_group_members')
      .select('id, is_active')
      .eq('group_id', groupId)
      .eq('virtual_friend_id', virtualFriendId)
      .maybeSingle();

    if (existing) {
      if (existing.is_active) {
        return { member: null, error: 'El amigo ya es miembro del grupo' };
      }
      // Reactivar miembro
      const { data, error } = await supabase
        .from('expense_group_members')
        .update({ is_active: true })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return { member: data, error: null };
    }

    const { data, error } = await supabase
      .from('expense_group_members')
      .insert({
        group_id: groupId,
        virtual_friend_id: virtualFriendId,
        display_name: displayName,
        role: 'member'
      })
      .select()
      .single();

    if (error) throw error;
    return { member: data, error: null };
  } catch (error) {
    console.error('Error agregando amigo virtual:', error);
    return { member: null, error: error.message };
  }
};

/**
 * Remover un miembro del grupo
 */
export const removeMember = async (memberId) => {
  try {
    const { error } = await supabase
      .from('expense_group_members')
      .update({ is_active: false })
      .eq('id', memberId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error removiendo miembro:', error);
    return { error: error.message };
  }
};

// ==========================================
// GASTOS COMPARTIDOS
// ==========================================

/**
 * Obtener gastos de un grupo
 * Por defecto solo muestra gastos aprobados, usa includeAll para ver todos
 */
export const getGroupExpenses = async (groupId, filters = {}) => {
  try {
    let query = supabase
      .from('shared_expenses')
      .select(`
        *,
        creator:created_by (
          first_name,
          last_name,
          nickname
        ),
        payers:shared_expense_payers (
          id,
          member_id,
          amount_paid,
          member:member_id (
            id,
            display_name,
            user_id,
            virtual_friend_id,
            profiles:user_id (first_name, last_name, avatar_url),
            virtual_friends:virtual_friend_id (name)
          )
        ),
        splits:shared_expense_splits (
          id,
          member_id,
          amount_owed,
          amount_paid,
          is_settled,
          member:member_id (
            id,
            display_name,
            user_id,
            virtual_friend_id,
            profiles:user_id (first_name, last_name, avatar_url),
            virtual_friends:virtual_friend_id (name)
          )
        ),
        validations:shared_expense_validations (
          id,
          member_id,
          user_id,
          status,
          responded_at,
          rejection_reason
        )
      `)
      .eq('group_id', groupId)
      .order('expense_date', { ascending: false });

    // Por defecto, solo mostrar gastos aprobados (a menos que se pida incluir todos)
    if (!filters.includeAll) {
      // Mostrar aprobados y pendientes (pero no rechazados)
      query = query.in('validation_status', ['approved', 'pending']);
    }

    // Filtros opcionales
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.settled !== undefined) {
      query = query.eq('is_settled', filters.settled);
    }
    if (filters.startDate) {
      query = query.gte('expense_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('expense_date', filters.endDate);
    }
    if (filters.validationStatus) {
      query = query.eq('validation_status', filters.validationStatus);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Formatear los datos
    const expenses = data.map(expense => ({
      ...expense,
      payers: expense.payers.map(p => ({
        ...p,
        displayName: p.member?.display_name || 
          (p.member?.profiles ? `${p.member.profiles.first_name} ${p.member.profiles.last_name}` : p.member?.virtual_friends?.name)
      })),
      splits: expense.splits.map(s => ({
        ...s,
        displayName: s.member?.display_name || 
          (s.member?.profiles ? `${s.member.profiles.first_name} ${s.member.profiles.last_name}` : s.member?.virtual_friends?.name)
      })),
      // Agregar info de validación
      isPending: expense.validation_status === 'pending',
      isRejected: expense.validation_status === 'rejected',
      pendingValidators: expense.validations?.filter(v => v.status === 'pending')?.length || 0
    }));

    return { expenses, error: null };
  } catch (error) {
    console.error('Error obteniendo gastos del grupo:', error);
    return { expenses: [], error: error.message };
  }
};

/**
 * Crear un gasto compartido
 * @param {Object} expenseData - Datos del gasto
 * @param {UUID} expenseData.groupId - ID del grupo
 * @param {string} expenseData.description - Descripción del gasto
 * @param {number} expenseData.totalAmount - Monto total
 * @param {string} expenseData.category - Categoría
 * @param {Date} expenseData.expenseDate - Fecha del gasto
 * @param {string} expenseData.splitType - Tipo de división: 'equal', 'custom', 'percentage'
 * @param {Array} expenseData.payers - Array de { memberId, amount }
 * @param {Array} expenseData.splits - Array de { memberId, amount } (para custom) o se calcula automático
 * @param {boolean} expenseData.skipValidation - Si es true, el gasto se aprueba automáticamente (para grupos de 1 persona)
 */
export const createSharedExpense = async (userId, expenseData) => {
  try {
    // Obtener miembros del grupo para determinar si necesita validación
    const { data: groupMembers } = await supabase
      .from('expense_group_members')
      .select('id, user_id, virtual_friend_id, display_name')
      .eq('group_id', expenseData.groupId)
      .eq('is_active', true);

    // Obtener participantes que deben validar (usuarios reales, excepto el creador)
    const participantIds = expenseData.participantIds || groupMembers?.map(m => m.id) || [];
    const participantMembers = groupMembers?.filter(m => participantIds.includes(m.id)) || [];
    
    // Usuarios reales que deben validar (no el creador, no amigos virtuales)
    const validatorsNeeded = participantMembers.filter(m => 
      m.user_id && m.user_id !== userId
    );

    // Determinar si necesita validación
    const needsValidation = validatorsNeeded.length > 0 && !expenseData.skipValidation;

    // 1. Crear el gasto principal
    const { data: expense, error: expenseError } = await supabase
      .from('shared_expenses')
      .insert({
        group_id: expenseData.groupId,
        description: expenseData.description,
        total_amount: expenseData.totalAmount,
        category: expenseData.category || 'general',
        expense_date: expenseData.expenseDate || new Date().toISOString().split('T')[0],
        split_type: expenseData.splitType || 'equal',
        notes: expenseData.notes || null,
        currency: expenseData.currency || 'ARS',
        currency_symbol: expenseData.currencySymbol || '$',
        created_by: userId,
        validation_status: needsValidation ? 'pending' : 'approved'
      })
      .select()
      .single();

    if (expenseError) throw expenseError;

    // 2. Registrar quién pagó
    const payersToInsert = expenseData.payers.map(p => ({
      expense_id: expense.id,
      member_id: p.memberId,
      amount_paid: p.amount
    }));

    const { error: payersError } = await supabase
      .from('shared_expense_payers')
      .insert(payersToInsert);

    if (payersError) throw payersError;

    // 3. Calcular y registrar la división
    let splitsToInsert = [];

    // Si hay participantes específicos, usar esos; si no, todos los miembros
    if (expenseData.splits && expenseData.splits.length > 0) {
      // Usar los splits proporcionados (ya calculados desde el frontend)
      splitsToInsert = expenseData.splits.map(s => ({
        expense_id: expense.id,
        member_id: s.memberId,
        amount_owed: Math.round(s.amount * 100) / 100
      }));
    } else if (expenseData.participantIds && expenseData.participantIds.length > 0) {
      // División equitativa entre participantes específicos
      const splitAmount = expenseData.totalAmount / expenseData.participantIds.length;
      
      splitsToInsert = expenseData.participantIds.map(memberId => ({
        expense_id: expense.id,
        member_id: memberId,
        amount_owed: Math.round(splitAmount * 100) / 100
      }));
    } else {
      // Fallback: División equitativa entre todos los miembros activos
      const splitAmount = expenseData.totalAmount / groupMembers.length;
      
      splitsToInsert = groupMembers.map(m => ({
        expense_id: expense.id,
        member_id: m.id,
        amount_owed: Math.round(splitAmount * 100) / 100
      }));
    }

    const { error: splitsError } = await supabase
      .from('shared_expense_splits')
      .insert(splitsToInsert);

    if (splitsError) throw splitsError;

    // 4. Si necesita validación, crear registros de validación y enviar notificaciones
    if (needsValidation) {
      const validationsToInsert = validatorsNeeded.map(m => ({
        expense_id: expense.id,
        member_id: m.id,
        user_id: m.user_id,
        status: 'pending'
      }));

      const { error: validationsError } = await supabase
        .from('shared_expense_validations')
        .insert(validationsToInsert);

      if (validationsError) {
        console.warn('Error creando validaciones (tabla puede no existir):', validationsError);
      }

      // Enviar notificaciones a los validadores
      try {
        const { createNotification } = await import('./notificationsService');
        
        // Obtener nombre del creador
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .single();
        
        const creatorName = creatorProfile 
          ? `${creatorProfile.first_name || ''} ${creatorProfile.last_name || ''}`.trim() 
          : 'Un usuario';

        // Obtener nombre del grupo
        const { data: groupData } = await supabase
          .from('expense_groups')
          .select('name')
          .eq('id', expenseData.groupId)
          .single();

        for (const validator of validatorsNeeded) {
          // Calcular la parte del validador
          const validatorSplit = splitsToInsert.find(s => s.member_id === validator.id);
          const validatorShare = validatorSplit?.amount_owed || (expenseData.totalAmount / participantMembers.length);

          await createNotification({
            userId: validator.user_id,
            type: 'expense_validation',
            title: '📋 Nuevo gasto por validar',
            message: `${creatorName} registró un gasto compartido "${expenseData.description}" por ${expenseData.currencySymbol || '$'}${expenseData.totalAmount.toLocaleString('es-AR')} en el grupo "${groupData?.name || 'Grupo'}". Tu parte: ${expenseData.currencySymbol || '$'}${validatorShare.toLocaleString('es-AR')}. ¿Reconoces este gasto?`,
            data: {
              expense_id: expense.id,
              expense_description: expenseData.description,
              expense_amount: expenseData.totalAmount,
              your_share: validatorShare,
              group_id: expenseData.groupId,
              group_name: groupData?.name,
              creator_id: userId,
              creator_name: creatorName,
              currency_symbol: expenseData.currencySymbol || '$'
            },
            actionRequired: true,
            actionType: 'expense_validation'
          });
        }
      } catch (notifError) {
        console.warn('Error enviando notificaciones de validación:', notifError);
      }
    }

    return { 
      expense, 
      error: null,
      needsValidation,
      validatorsCount: validatorsNeeded.length
    };
  } catch (error) {
    console.error('Error creando gasto compartido:', error);
    return { expense: null, error: error.message };
  }
};

/**
 * Aprobar un gasto compartido pendiente de validación
 */
export const approveSharedExpense = async (expenseId, userId) => {
  try {
    const { data, error } = await supabase
      .rpc('approve_shared_expense', {
        p_expense_id: expenseId,
        p_user_id: userId
      });

    if (error) throw error;

    // Si el gasto fue aprobado por todos, notificar al creador
    if (data?.expense_approved && data?.creator_id) {
      try {
        const { createNotification } = await import('./notificationsService');
        
        // Obtener info del gasto
        const { data: expense } = await supabase
          .from('shared_expenses')
          .select('description, total_amount, currency_symbol, group_id, expense_groups(name)')
          .eq('id', expenseId)
          .single();

        await createNotification({
          userId: data.creator_id,
          type: 'expense_approved',
          title: '✅ Gasto aprobado',
          message: `Tu gasto "${expense?.description}" por ${expense?.currency_symbol || '$'}${expense?.total_amount?.toLocaleString('es-AR')} ha sido aprobado por todos los participantes y ahora está activo.`,
          data: {
            expense_id: expenseId,
            group_name: expense?.expense_groups?.name
          }
        });
      } catch (notifError) {
        console.warn('Error notificando aprobación:', notifError);
      }
    }

    return { 
      success: data?.success, 
      expenseApproved: data?.expense_approved,
      pendingCount: data?.pending_count,
      message: data?.message,
      error: data?.success ? null : (data?.error || 'Error desconocido')
    };
  } catch (error) {
    console.error('Error aprobando gasto:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Rechazar un gasto compartido pendiente de validación
 */
export const rejectSharedExpense = async (expenseId, userId, reason = null) => {
  try {
    const { data, error } = await supabase
      .rpc('reject_shared_expense', {
        p_expense_id: expenseId,
        p_user_id: userId,
        p_reason: reason
      });

    if (error) throw error;

    // Notificar al creador sobre el rechazo
    if (data?.expense_rejected && data?.creator_id) {
      try {
        const { createNotification } = await import('./notificationsService');
        
        // Obtener nombre de quien rechazó
        const { data: rejecterProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .single();
        
        const rejecterName = rejecterProfile 
          ? `${rejecterProfile.first_name || ''} ${rejecterProfile.last_name || ''}`.trim() 
          : 'Un participante';

        await createNotification({
          userId: data.creator_id,
          type: 'expense_rejected',
          title: '❌ Gasto rechazado',
          message: `${rejecterName} rechazó el gasto "${data.expense_description}".${reason ? ` Motivo: ${reason}` : ''} El gasto no será contabilizado.`,
          data: {
            expense_id: expenseId,
            rejected_by: userId,
            rejection_reason: reason
          }
        });
      } catch (notifError) {
        console.warn('Error notificando rechazo:', notifError);
      }
    }

    return { 
      success: data?.success, 
      expenseRejected: data?.expense_rejected,
      message: data?.message,
      error: data?.success ? null : (data?.error || 'Error desconocido')
    };
  } catch (error) {
    console.error('Error rechazando gasto:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener gastos pendientes de validación para el usuario
 */
export const getPendingValidations = async (userId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_pending_expense_validations', { p_user_id: userId });

    if (error) throw error;

    return { validations: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo validaciones pendientes:', error);
    return { validations: [], error: error.message };
  }
};

/**
 * Obtener cantidad de gastos pendientes de validación
 */
export const getPendingValidationsCount = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('shared_expense_validations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;

    return { count: data || 0, error: null };
  } catch (error) {
    console.error('Error contando validaciones pendientes:', error);
    return { count: 0, error: error.message };
  }
};

/**
 * Actualizar un gasto compartido
 */
export const updateSharedExpense = async (expenseId, updates) => {
  try {
    const { data, error } = await supabase
      .from('shared_expenses')
      .update({
        description: updates.description,
        total_amount: updates.totalAmount,
        category: updates.category,
        expense_date: updates.expenseDate,
        notes: updates.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', expenseId)
      .select()
      .single();

    if (error) throw error;
    return { expense: data, error: null };
  } catch (error) {
    console.error('Error actualizando gasto:', error);
    return { expense: null, error: error.message };
  }
};

/**
 * Solicitar eliminación de un gasto compartido
 * Envía notificación a todos los participantes para que aprueben la eliminación
 */
export const requestDeleteSharedExpense = async (expenseId, requesterId, requesterName) => {
  try {
    // Obtener el gasto con sus splits para saber quiénes participan
    const { data: expense, error: expenseError } = await supabase
      .from('shared_expenses')
      .select(`
        *,
        splits:shared_expense_splits(
          user_id
        )
      `)
      .eq('id', expenseId)
      .single();

    if (expenseError) throw expenseError;

    // Obtener todos los participantes únicos (excepto el solicitante)
    const participantIds = [...new Set(expense.splits.map(s => s.user_id))]
      .filter(id => id !== requesterId);

    if (participantIds.length === 0) {
      // Si no hay otros participantes, eliminar directamente
      const { error } = await supabase
        .from('shared_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
      return { error: null, needsApproval: false };
    }

    // Crear solicitud de eliminación pendiente
    const { data: deleteRequest, error: requestError } = await supabase
      .from('shared_expense_delete_requests')
      .insert({
        expense_id: expenseId,
        requester_id: requesterId,
        status: 'pending',
        approvals_needed: participantIds.length,
        approvals_received: 0
      })
      .select()
      .single();

    // Si la tabla no existe, crear las notificaciones directamente
    if (requestError && requestError.code === '42P01') {
      console.log('Tabla shared_expense_delete_requests no existe, enviando notificaciones...');
    } else if (requestError) {
      throw requestError;
    }

    // Importar servicio de notificaciones
    const { createNotification } = await import('./notificationsService');

    // Enviar notificación a cada participante
    for (const participantId of participantIds) {
      await createNotification({
        userId: participantId,
        type: 'delete_request',
        title: '🗑️ Solicitud de eliminación',
        message: `${requesterName} quiere eliminar el gasto compartido "${expense.description}" por ${expense.currency_symbol || '$'}${expense.amount.toLocaleString('es-AR')}. ¿Estás de acuerdo?`,
        data: {
          expense_id: expenseId,
          expense_description: expense.description,
          expense_amount: expense.amount,
          requester_id: requesterId,
          requester_name: requesterName,
          delete_request_id: deleteRequest?.id || null
        },
        actionRequired: true,
        actionType: 'delete_approval'
      });
    }

    return { 
      error: null, 
      needsApproval: true,
      requestId: deleteRequest?.id || null,
      participantsNotified: participantIds.length
    };
  } catch (error) {
    console.error('Error solicitando eliminación de gasto:', error);
    return { error: error.message, needsApproval: false };
  }
};

/**
 * Eliminar un gasto compartido (directamente - solo usar cuando ya está aprobado)
 */
export const deleteSharedExpense = async (expenseId) => {
  try {
    const { error } = await supabase
      .from('shared_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando gasto:', error);
    return { error: error.message };
  }
};

/**
 * Finalizar/Saldar un gasto compartido
 * Marca el gasto como saldado y actualiza los balances de los miembros
 */
export const settleExpense = async (expenseId) => {
  try {
    // Marcar el gasto como saldado
    const { data: expense, error: expenseError } = await supabase
      .from('shared_expenses')
      .update({ 
        is_settled: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', expenseId)
      .select()
      .single();

    if (expenseError) throw expenseError;

    // Obtener todos los splits y actualizarlos uno por uno
    const { data: splits } = await supabase
      .from('shared_expense_splits')
      .select('id, amount_owed')
      .eq('expense_id', expenseId);
    
    for (const split of splits || []) {
      await supabase
        .from('shared_expense_splits')
        .update({ is_settled: true, amount_paid: split.amount_owed })
        .eq('id', split.id);
    }

    return { expense, error: null };
  } catch (error) {
    console.error('Error finalizando gasto:', error);
    return { expense: null, error: error.message };
  }
};

/**
 * Obtener detalle completo de un gasto con todos sus pagadores y divisiones
 */
export const getExpenseDetails = async (expenseId) => {
  try {
    const { data: expense, error: expenseError } = await supabase
      .from('shared_expenses')
      .select(`
        *,
        creator:created_by (
          id,
          first_name,
          last_name,
          nickname,
          email
        )
      `)
      .eq('id', expenseId)
      .single();

    if (expenseError) throw expenseError;

    // Obtener pagadores
    const { data: payers, error: payersError } = await supabase
      .from('shared_expense_payers')
      .select(`
        id,
        amount_paid,
        member:member_id (
          id,
          display_name,
          user_id,
          virtual_friend_id,
          profiles:user_id (first_name, last_name, nickname, avatar_url),
          virtual_friends:virtual_friend_id (name)
        )
      `)
      .eq('expense_id', expenseId);

    if (payersError) throw payersError;

    // Obtener divisiones
    const { data: splits, error: splitsError } = await supabase
      .from('shared_expense_splits')
      .select(`
        id,
        amount_owed,
        amount_paid,
        is_settled,
        member:member_id (
          id,
          display_name,
          user_id,
          virtual_friend_id,
          profiles:user_id (first_name, last_name, nickname, avatar_url),
          virtual_friends:virtual_friend_id (name)
        )
      `)
      .eq('expense_id', expenseId);

    if (splitsError) throw splitsError;

    // Formatear datos
    const formattedPayers = payers.map(p => ({
      id: p.id,
      memberId: p.member?.id,
      userId: p.member?.user_id,
      displayName: p.member?.display_name || 
        (p.member?.profiles ? `${p.member.profiles.first_name} ${p.member.profiles.last_name}` : p.member?.virtual_friends?.name),
      nickname: p.member?.profiles?.nickname,
      avatarUrl: p.member?.profiles?.avatar_url,
      amountPaid: parseFloat(p.amount_paid) || 0,
      isVirtual: p.member?.virtual_friend_id !== null
    }));

    const formattedSplits = splits.map(s => ({
      id: s.id,
      memberId: s.member?.id,
      userId: s.member?.user_id,
      displayName: s.member?.display_name || 
        (s.member?.profiles ? `${s.member.profiles.first_name} ${s.member.profiles.last_name}` : s.member?.virtual_friends?.name),
      nickname: s.member?.profiles?.nickname,
      avatarUrl: s.member?.profiles?.avatar_url,
      amountOwed: parseFloat(s.amount_owed) || 0,
      amountPaid: parseFloat(s.amount_paid) || 0,
      isSettled: s.is_settled,
      isVirtual: s.member?.virtual_friend_id !== null,
      pendingAmount: (parseFloat(s.amount_owed) || 0) - (parseFloat(s.amount_paid) || 0)
    }));

    return { 
      expense: {
        ...expense,
        payers: formattedPayers,
        splits: formattedSplits,
        totalPaid: formattedPayers.reduce((sum, p) => sum + p.amountPaid, 0),
        totalOwed: formattedSplits.reduce((sum, s) => sum + s.amountOwed, 0),
        totalPending: formattedSplits.reduce((sum, s) => sum + s.pendingAmount, 0)
      }, 
      error: null 
    };
  } catch (error) {
    console.error('Error obteniendo detalle del gasto:', error);
    return { expense: null, error: error.message };
  }
};

// ==========================================
// LIQUIDACIONES
// ==========================================

/**
 * Calcular deudas detalladas entre miembros del grupo
 * 
 * Lógica: 
 * - Cuando alguien paga un gasto, los demás participantes le deben su parte
 * - El balance neto entre A y B se calcula así:
 *   - Lo que B le debe a A (por los gastos que A pagó donde B participó)
 *   - MENOS lo que A le debe a B (por los gastos que B pagó donde A participó)
 * - Si el resultado es positivo, B le debe a A. Si es negativo, A le debe a B.
 * 
 * Ejemplo:
 * - Yo pago $10 (compartido entre 2) -> Mi amiga me debe $5
 * - Mi amiga paga $20 (compartido entre 2) -> Yo le debo $10
 * - Balance neto: Ella me debe $5, yo le debo $10 -> Yo le debo $5 ($10 - $5)
 */
export const calculateDetailedDebts = async (groupId) => {
  try {
    // Obtener todos los gastos APROBADOS y no saldados del grupo
    const { data: expenses, error: expensesError } = await supabase
      .from('shared_expenses')
      .select(`
        id,
        description,
        total_amount,
        expense_date,
        is_settled,
        currency_symbol,
        validation_status
      `)
      .eq('group_id', groupId)
      .eq('is_settled', false)
      .eq('validation_status', 'approved'); // Solo gastos aprobados

    if (expensesError) throw expensesError;

    // Obtener miembros
    const { data: members, error: membersError } = await supabase
      .from('expense_group_members')
      .select(`
        id,
        user_id,
        virtual_friend_id,
        display_name,
        profiles:user_id (first_name, last_name, nickname),
        virtual_friends:virtual_friend_id (name)
      `)
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (membersError) throw membersError;

    // Mapa de miembros para acceso rápido
    const membersMap = {};
    members.forEach(m => {
      membersMap[m.id] = {
        memberId: m.id,
        userId: m.user_id,
        virtualFriendId: m.virtual_friend_id,
        displayName: m.display_name || 
          (m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : m.virtual_friends?.name),
        nickname: m.profiles?.nickname,
        isVirtual: m.virtual_friend_id !== null
      };
    });

    // Matriz de deudas: owes[deudor][acreedor] = monto que deudor debe a acreedor
    // Inicializar en 0
    const owes = {};
    members.forEach(m => {
      owes[m.id] = {};
      members.forEach(other => {
        if (m.id !== other.id) {
          owes[m.id][other.id] = 0;
        }
      });
    });

    // Procesar cada gasto
    for (const expense of expenses || []) {
      // Obtener pagadores de este gasto
      const { data: payers } = await supabase
        .from('shared_expense_payers')
        .select('member_id, amount_paid')
        .eq('expense_id', expense.id);

      // Obtener splits de este gasto (cuánto debe cada participante)
      const { data: splits } = await supabase
        .from('shared_expense_splits')
        .select('member_id, amount_owed, amount_paid, is_settled')
        .eq('expense_id', expense.id);

      if (!payers || !splits || splits.length === 0) continue;

      // Crear mapa de pagos por miembro
      const paymentsByMember = {};
      payers.forEach(p => {
        paymentsByMember[p.member_id] = parseFloat(p.amount_paid) || 0;
      });

      // Crear mapa de lo que debe cada miembro
      const owedByMember = {};
      splits.forEach(s => {
        if (!s.is_settled) {
          owedByMember[s.member_id] = parseFloat(s.amount_owed) || 0;
        }
      });

      // Para cada participante, calcular su balance en este gasto
      // Balance = lo que pagó - lo que le correspondía
      // Positivo = pagó de más (acreedor), Negativo = pagó de menos (deudor)
      const balances = {};
      for (const memberId of Object.keys(owedByMember)) {
        const paid = paymentsByMember[memberId] || 0;
        const owed = owedByMember[memberId] || 0;
        balances[memberId] = paid - owed;
      }

      // Separar acreedores (balance positivo) y deudores (balance negativo)
      const creditors = Object.entries(balances)
        .filter(([_, balance]) => balance > 0.01)
        .map(([id, balance]) => ({ id, credit: balance }));
      
      const debtors = Object.entries(balances)
        .filter(([_, balance]) => balance < -0.01)
        .map(([id, balance]) => ({ id, debt: Math.abs(balance) }));

      // Distribuir las deudas: cada deudor debe a cada acreedor proporcionalmente
      const totalCredit = creditors.reduce((sum, c) => sum + c.credit, 0);
      
      if (totalCredit > 0) {
        for (const debtor of debtors) {
          for (const creditor of creditors) {
            // Proporción de este acreedor en el total de créditos
            const proportion = creditor.credit / totalCredit;
            // Lo que el deudor debe a este acreedor
            const amountOwed = debtor.debt * proportion;
            
            if (amountOwed > 0.01 && owes[debtor.id] && owes[debtor.id][creditor.id] !== undefined) {
              owes[debtor.id][creditor.id] += amountOwed;
            }
          }
        }
      }
    }

    // Simplificar deudas: calcular balance neto entre cada par de personas
    // Si A debe a B $10 y B debe a A $3 -> A debe a B $7 (neto)
    const simplifiedDebts = [];
    const processed = new Set();

    for (const debtorId of Object.keys(owes)) {
      for (const creditorId of Object.keys(owes[debtorId])) {
        // Evitar procesar el mismo par dos veces
        const key = [debtorId, creditorId].sort().join('-');
        if (processed.has(key)) continue;
        processed.add(key);

        // Deuda de A hacia B
        const debtAtoB = owes[debtorId][creditorId] || 0;
        // Deuda de B hacia A
        const debtBtoA = owes[creditorId]?.[debtorId] || 0;
        
        // Balance neto: positivo significa que A debe a B
        const netDebt = Math.round((debtAtoB - debtBtoA) * 100) / 100;

        // Solo agregar si hay una deuda significativa (> 1 centavo)
        if (Math.abs(netDebt) > 0.01) {
          if (netDebt > 0) {
            // debtorId debe a creditorId
            simplifiedDebts.push({
              from: membersMap[debtorId],
              to: membersMap[creditorId],
              amount: netDebt
            });
          } else {
            // creditorId debe a debtorId (deuda inversa)
            simplifiedDebts.push({
              from: membersMap[creditorId],
              to: membersMap[debtorId],
              amount: Math.abs(netDebt)
            });
          }
        }
      }
    }

    return { debts: simplifiedDebts, membersMap, error: null };
  } catch (error) {
    console.error('Error calculando deudas:', error);
    return { debts: [], membersMap: {}, error: error.message };
  }
};

/**
 * Obtener deudas entre dos miembros específicos
 */
export const getDebtBetweenMembers = async (groupId, member1Id, member2Id) => {
  try {
    const { debts } = await calculateDetailedDebts(groupId);
    
    // Buscar deuda entre estos dos miembros
    const debt = debts.find(d => 
      (d.from.memberId === member1Id && d.to.memberId === member2Id) ||
      (d.from.memberId === member2Id && d.to.memberId === member1Id)
    );

    return { debt, error: null };
  } catch (error) {
    console.error('Error obteniendo deuda entre miembros:', error);
    return { debt: null, error: error.message };
  }
};

/**
 * Obtener resumen de balances del grupo
 */
export const getGroupBalances = async (groupId) => {
  try {
    // Calcular deudas detalladas
    const { debts: detailedDebts } = await calculateDetailedDebts(groupId);

    const { data: members, error } = await supabase
      .from('expense_group_members')
      .select(`
        id,
        user_id,
        virtual_friend_id,
        display_name,
        balance,
        profiles:user_id (first_name, last_name, nickname),
        virtual_friends:virtual_friend_id (name)
      `)
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (error) throw error;

    // Calcular balance real basado en deudas
    const balanceMap = {};
    members.forEach(m => {
      balanceMap[m.id] = 0;
    });

    // Sumar deudas y créditos
    detailedDebts.forEach(debt => {
      if (balanceMap[debt.from.memberId] !== undefined) {
        balanceMap[debt.from.memberId] -= debt.amount;
      }
      if (balanceMap[debt.to.memberId] !== undefined) {
        balanceMap[debt.to.memberId] += debt.amount;
      }
    });

    const balances = members.map(m => ({
      memberId: m.id,
      userId: m.user_id,
      virtualFriendId: m.virtual_friend_id,
      displayName: m.display_name || 
        (m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : m.virtual_friends?.name),
      nickname: m.profiles?.nickname,
      balance: Math.round((balanceMap[m.id] || 0) * 100) / 100,
      isVirtual: m.virtual_friend_id !== null
    }));

    // Usar las deudas detalladas como sugerencias de liquidación
    const settlements = detailedDebts;

    return { balances, settlements, error: null };
  } catch (error) {
    console.error('Error obteniendo balances:', error);
    return { balances: [], settlements: [], error: error.message };
  }
};

/**
 * Calcular sugerencias de liquidación para minimizar transacciones
 */
const calculateSettlementSuggestions = (balances) => {
  // Separar deudores y acreedores
  const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, amount: Math.abs(b.balance) }));
  const creditors = balances.filter(b => b.balance > 0).map(b => ({ ...b, amount: b.balance }));

  const settlements = [];

  // Algoritmo greedy para minimizar transacciones
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) { // Ignorar centavos
      settlements.push({
        from: debtor,
        to: creditor,
        amount: Math.round(amount * 100) / 100
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return settlements;
};

/**
 * Registrar una liquidación
 */
export const createSettlement = async (userId, settlementData) => {
  try {
    const { data, error } = await supabase
      .from('group_settlements')
      .insert({
        group_id: settlementData.groupId,
        from_member_id: settlementData.fromMemberId,
        to_member_id: settlementData.toMemberId,
        amount: settlementData.amount,
        notes: settlementData.notes || null,
        created_by: userId,
        linked_to_bank: settlementData.linkedToBank || false,
        bank_account_id: settlementData.bankAccountId || null,
        linked_expense_id: settlementData.linkedExpenseId || null
      })
      .select()
      .single();

    if (error) throw error;
    return { settlement: data, error: null };
  } catch (error) {
    console.error('Error creando liquidación:', error);
    return { settlement: null, error: error.message };
  }
};

/**
 * Confirmar una liquidación
 */
export const confirmSettlement = async (settlementId, userId) => {
  try {
    const { data, error } = await supabase
      .from('group_settlements')
      .update({
        status: 'confirmed',
        confirmed_by: userId,
        settled_at: new Date().toISOString()
      })
      .eq('id', settlementId)
      .select()
      .single();

    if (error) throw error;

    // Actualizar splits relacionados
    // TODO: Marcar los splits como liquidados

    return { settlement: data, error: null };
  } catch (error) {
    console.error('Error confirmando liquidación:', error);
    return { settlement: null, error: error.message };
  }
};

/**
 * Obtener historial de liquidaciones de un grupo
 */
export const getGroupSettlements = async (groupId) => {
  try {
    const { data, error } = await supabase
      .from('group_settlements')
      .select(`
        *,
        from_member:from_member_id (
          id,
          display_name,
          user_id,
          profiles:user_id (first_name, last_name),
          virtual_friends:virtual_friend_id (name)
        ),
        to_member:to_member_id (
          id,
          display_name,
          user_id,
          profiles:user_id (first_name, last_name),
          virtual_friends:virtual_friend_id (name)
        ),
        creator:created_by (first_name, last_name)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const settlements = data.map(s => ({
      ...s,
      fromDisplayName: s.from_member?.display_name || 
        (s.from_member?.profiles ? `${s.from_member.profiles.first_name} ${s.from_member.profiles.last_name}` : s.from_member?.virtual_friends?.name),
      toDisplayName: s.to_member?.display_name || 
        (s.to_member?.profiles ? `${s.to_member.profiles.first_name} ${s.to_member.profiles.last_name}` : s.to_member?.virtual_friends?.name)
    }));

    return { settlements, error: null };
  } catch (error) {
    console.error('Error obteniendo liquidaciones:', error);
    return { settlements: [], error: error.message };
  }
};

// ==========================================
// CATEGORÍAS
// ==========================================

/**
 * Obtener categorías del usuario
 */
export const getUserCategories = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('shared_expense_categories')
      .select('*')
      .or(`user_id.eq.${userId},is_default.eq.true`)
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;
    return { categories: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    return { categories: [], error: error.message };
  }
};

/**
 * Crear categoría personalizada
 */
export const createCategory = async (userId, categoryData) => {
  try {
    const { data, error } = await supabase
      .from('shared_expense_categories')
      .insert({
        user_id: userId,
        name: categoryData.name,
        icon: categoryData.icon || 'tag',
        color: categoryData.color || '#6366f1'
      })
      .select()
      .single();

    if (error) throw error;
    return { category: data, error: null };
  } catch (error) {
    console.error('Error creando categoría:', error);
    return { category: null, error: error.message };
  }
};

/**
 * Eliminar categoría personalizada
 */
export const deleteCategory = async (categoryId) => {
  try {
    const { error } = await supabase
      .from('shared_expense_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    return { error: error.message };
  }
};

// ==========================================
// ESTADÍSTICAS
// ==========================================

/**
 * Obtener estadísticas del grupo
 */
export const getGroupStats = async (groupId) => {
  try {
    const { data: expenses, error } = await supabase
      .from('shared_expenses')
      .select('total_amount, category, expense_date, is_settled')
      .eq('group_id', groupId);

    if (error) throw error;

    const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.total_amount), 0);
    const totalPending = expenses.filter(e => !e.is_settled).reduce((sum, e) => sum + parseFloat(e.total_amount), 0);
    const totalSettled = expenses.filter(e => e.is_settled).reduce((sum, e) => sum + parseFloat(e.total_amount), 0);
    
    // Por categoría
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + parseFloat(e.total_amount);
      return acc;
    }, {});

    // Por mes
    const byMonth = expenses.reduce((acc, e) => {
      const month = e.expense_date.substring(0, 7);
      acc[month] = (acc[month] || 0) + parseFloat(e.total_amount);
      return acc;
    }, {});

    return {
      stats: {
        totalSpent,
        totalPending,
        totalSettled,
        expenseCount: expenses.length,
        byCategory,
        byMonth
      },
      error: null
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return { stats: null, error: error.message };
  }
};

// ==========================================
// SOLICITUDES DE PAGO (Payment Requests)
// ==========================================

/**
 * Crear una solicitud de pago (el deudor dice que pagó) - "Ya pagué"
 */
export const createPaymentRequest = async (requestData) => {
  try {
    const { data, error } = await supabase
      .from('shared_payment_requests')
      .insert({
        expense_id: requestData.expenseId || null,
        group_id: requestData.groupId,
        debtor_member_id: requestData.debtorMemberId,
        debtor_user_id: requestData.debtorUserId,
        creditor_member_id: requestData.creditorMemberId,
        creditor_user_id: requestData.creditorUserId,
        amount: requestData.amount,
        currency: requestData.currency || 'ARS',
        currency_symbol: requestData.currencySymbol || '$',
        request_type: 'payment_claim',
        debtor_notes: requestData.notes || null
      })
      .select()
      .single();

    if (error) throw error;
    return { request: data, error: null };
  } catch (error) {
    console.error('Error creando solicitud de pago:', error);
    return { request: null, error: error.message };
  }
};

/**
 * Crear una solicitud de cobro (el acreedor quiere cobrar) - "Cobrar"
 */
export const createCollectionRequest = async (requestData) => {
  try {
    const { data, error } = await supabase
      .from('shared_payment_requests')
      .insert({
        expense_id: requestData.expenseId || null,
        group_id: requestData.groupId,
        debtor_member_id: requestData.debtorMemberId,
        debtor_user_id: requestData.debtorUserId,
        creditor_member_id: requestData.creditorMemberId,
        creditor_user_id: requestData.creditorUserId,
        amount: requestData.amount,
        currency: requestData.currency || 'ARS',
        currency_symbol: requestData.currencySymbol || '$',
        request_type: 'collection_request',
        creditor_notes: requestData.notes || null
      })
      .select()
      .single();

    if (error) throw error;
    return { request: data, error: null };
  } catch (error) {
    console.error('Error creando solicitud de cobro:', error);
    return { request: null, error: error.message };
  }
};

/**
 * Obtener solicitudes de pago pendientes para un usuario
 * Incluye tanto solicitudes de pago (payment_claim) como recordatorios de cobro (collection_request)
 */
export const getPendingPaymentRequests = async (userId) => {
  try {
    // Solicitudes de pago donde el usuario es el acreedor (debe confirmar)
    const { data: paymentClaims, error: error1 } = await supabase
      .from('shared_payment_requests')
      .select(`
        *,
        expense:expense_id (
          id,
          description,
          total_amount,
          expense_date
        ),
        group:group_id (
          id,
          name,
          icon
        ),
        debtor_member:debtor_member_id (
          id,
          display_name,
          user_id,
          profiles:user_id (first_name, last_name, nickname)
        )
      `)
      .eq('creditor_user_id', userId)
      .eq('status', 'pending')
      .eq('request_type', 'payment_claim')
      .order('created_at', { ascending: false });

    if (error1) throw error1;

    // Recordatorios de cobro donde el usuario es el deudor (le piden que pague)
    const { data: collectionRequests, error: error2 } = await supabase
      .from('shared_payment_requests')
      .select(`
        *,
        expense:expense_id (
          id,
          description,
          total_amount,
          expense_date
        ),
        group:group_id (
          id,
          name,
          icon
        ),
        creditor_member:creditor_member_id (
          id,
          display_name,
          user_id,
          profiles:user_id (first_name, last_name, nickname)
        )
      `)
      .eq('debtor_user_id', userId)
      .eq('status', 'pending')
      .eq('request_type', 'collection_request')
      .order('created_at', { ascending: false });

    if (error2) throw error2;

    // Formatear las solicitudes de pago
    const formattedPaymentClaims = (paymentClaims || []).map(r => ({
      ...r,
      otherPersonName: r.debtor_member?.display_name || 
        (r.debtor_member?.profiles ? `${r.debtor_member.profiles.first_name} ${r.debtor_member.profiles.last_name}` : 'Desconocido'),
      actionRequired: 'confirm_payment' // El acreedor debe confirmar que recibió el pago
    }));

    // Formatear los recordatorios de cobro
    const formattedCollectionRequests = (collectionRequests || []).map(r => ({
      ...r,
      otherPersonName: r.creditor_member?.display_name || 
        (r.creditor_member?.profiles ? `${r.creditor_member.profiles.first_name} ${r.creditor_member.profiles.last_name}` : 'Desconocido'),
      actionRequired: 'pay_now' // El deudor debe pagar
    }));

    return { 
      requests: [...formattedPaymentClaims, ...formattedCollectionRequests],
      paymentClaims: formattedPaymentClaims,
      collectionRequests: formattedCollectionRequests,
      error: null 
    };
  } catch (error) {
    console.error('Error obteniendo solicitudes de pago:', error);
    return { requests: [], paymentClaims: [], collectionRequests: [], error: error.message };
  }
};

/**
 * Confirmar una solicitud de pago
 * @param {string} requestId - ID de la solicitud
 * @param {string} notes - Notas opcionales
 * @param {string} bankAccountId - ID de la cuenta bancaria para registrar el gasto real
 */
export const confirmPaymentRequest = async (requestId, notes = null, bankAccountId = null) => {
  try {
    const { data, error } = await supabase.rpc('confirm_payment_request', {
      p_request_id: requestId,
      p_notes: notes,
      p_bank_account_id: bankAccountId
    });

    if (error) throw error;
    return { result: data, error: null };
  } catch (error) {
    console.error('Error confirmando pago:', error);
    return { result: null, error: error.message };
  }
};

/**
 * Rechazar una solicitud de pago / "No pagó"
 * @param {string} requestId - ID de la solicitud
 * @param {string} notes - Notas opcionales
 * @param {string} bankAccountId - ID de la cuenta bancaria para registrar el gasto asumido
 * @param {boolean} assumeExpense - Si es true, el acreedor asume el gasto total
 */
export const rejectPaymentRequest = async (requestId, notes = null, bankAccountId = null, assumeExpense = false) => {
  try {
    const { data, error } = await supabase.rpc('reject_payment_request', {
      p_request_id: requestId,
      p_notes: notes,
      p_bank_account_id: bankAccountId,
      p_assume_expense: assumeExpense
    });

    if (error) throw error;
    return { result: data, error: null };
  } catch (error) {
    console.error('Error rechazando pago:', error);
    return { result: null, error: error.message };
  }
};

/**
 * Obtener historial de pagos de un grupo
 */
export const getGroupPaymentHistory = async (groupId) => {
  try {
    const { data, error } = await supabase
      .from('shared_payment_requests')
      .select(`
        *,
        expense:expense_id (
          id,
          description
        ),
        debtor_member:debtor_member_id (
          display_name,
          profiles:user_id (first_name, last_name)
        ),
        creditor_member:creditor_member_id (
          display_name,
          profiles:user_id (first_name, last_name)
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { history: data, error: null };
  } catch (error) {
    console.error('Error obteniendo historial de pagos:', error);
    return { history: [], error: error.message };
  }
};

/**
 * Resignar deuda - El acreedor asume todo el gasto
 * @param {string} expenseId - ID del gasto
 * @param {string} creditorUserId - ID del usuario acreedor
 * @param {string} bankAccountId - ID de la cuenta bancaria (opcional)
 * @param {string} notes - Notas opcionales
 */
export const resignExpenseDebt = async (expenseId, creditorUserId, bankAccountId = null, notes = null) => {
  try {
    const { data, error } = await supabase.rpc('resign_expense_debt', {
      p_expense_id: expenseId,
      p_creditor_user_id: creditorUserId,
      p_bank_account_id: bankAccountId,
      p_notes: notes
    });

    if (error) throw error;
    return { result: data, error: null };
  } catch (error) {
    console.error('Error resignando deuda:', error);
    return { result: null, error: error.message };
  }
};

export default {
  // Grupos
  getUserGroups,
  getGroupDetails,
  createGroup,
  updateGroup,
  deleteGroup,
  // Miembros
  addMember,
  addVirtualMember,
  removeMember,
  // Gastos
  getGroupExpenses,
  getExpenseDetails,
  createSharedExpense,
  updateSharedExpense,
  deleteSharedExpense,
  requestDeleteSharedExpense,
  settleExpense,
  // Validación de gastos
  approveSharedExpense,
  rejectSharedExpense,
  getPendingValidations,
  getPendingValidationsCount,
  // Liquidaciones
  getGroupBalances,
  calculateDetailedDebts,
  getDebtBetweenMembers,
  createSettlement,
  confirmSettlement,
  getGroupSettlements,
  // Solicitudes de pago
  createPaymentRequest,
  createCollectionRequest,
  getPendingPaymentRequests,
  confirmPaymentRequest,
  rejectPaymentRequest,
  getGroupPaymentHistory,
  resignExpenseDebt,
  // Categorías
  getUserCategories,
  createCategory,
  deleteCategory,
  // Stats
  getGroupStats
};
