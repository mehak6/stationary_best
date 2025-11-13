'use client';

export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'last-write-wins' | 'manual';

export interface Conflict<T = any> {
  id: string;
  entity: 'product' | 'sale' | 'category' | 'party_purchase';
  localVersion: T;
  remoteVersion: T;
  localTimestamp: string;
  remoteTimestamp: string;
  resolved: boolean;
  resolution?: T;
  resolvedAt?: string;
}

// Store for unresolved conflicts
const conflictsStore: Map<string, Conflict> = new Map();

// Get all unresolved conflicts
export const getUnresolvedConflicts = (): Conflict[] => {
  return Array.from(conflictsStore.values()).filter(c => !c.resolved);
};

// Get conflicts for specific entity type
export const getConflictsByEntity = (entity: string): Conflict[] => {
  return Array.from(conflictsStore.values()).filter(
    c => c.entity === entity && !c.resolved
  );
};

// Add conflict to store
export const addConflict = (conflict: Conflict): void => {
  const key = `${conflict.entity}_${conflict.id}`;
  conflictsStore.set(key, conflict);
};

// Resolve conflict manually
export const resolveConflict = (
  conflictId: string,
  resolution: any
): void => {
  const conflict = conflictsStore.get(conflictId);
  if (conflict) {
    conflict.resolved = true;
    conflict.resolution = resolution;
    conflict.resolvedAt = new Date().toISOString();
    conflictsStore.set(conflictId, conflict);
  }
};

// Clear resolved conflicts
export const clearResolvedConflicts = (): void => {
  Array.from(conflictsStore.entries()).forEach(([key, conflict]) => {
    if (conflict.resolved) {
      conflictsStore.delete(key);
    }
  });
};

// Last-write-wins strategy
export const resolveLastWriteWins = <T extends { updated_at?: string; created_at: string }>(
  local: T,
  remote: T
): T => {
  const localTimestamp = local.updated_at || local.created_at;
  const remoteTimestamp = remote.updated_at || remote.created_at;

  return new Date(localTimestamp) > new Date(remoteTimestamp) ? local : remote;
};

// Local-wins strategy (prefer local changes)
export const resolveLocalWins = <T>(local: T, remote: T): T => {
  return local;
};

// Remote-wins strategy (prefer server changes)
export const resolveRemoteWins = <T>(local: T, remote: T): T => {
  return remote;
};

// Merge strategy (for specific fields)
export const resolveMerge = <T extends Record<string, any>>(
  local: T,
  remote: T,
  strategy: Record<string, 'local' | 'remote' | 'max' | 'min' | 'sum'>
): T => {
  const merged = { ...remote };

  Object.entries(strategy).forEach(([field, method]) => {
    if (method === 'local') {
      merged[field] = local[field];
    } else if (method === 'remote') {
      merged[field] = remote[field];
    } else if (method === 'max' && typeof local[field] === 'number' && typeof remote[field] === 'number') {
      merged[field] = Math.max(local[field], remote[field]);
    } else if (method === 'min' && typeof local[field] === 'number' && typeof remote[field] === 'number') {
      merged[field] = Math.min(local[field], remote[field]);
    } else if (method === 'sum' && typeof local[field] === 'number' && typeof remote[field] === 'number') {
      merged[field] = local[field] + remote[field];
    }
  });

  return merged as T;
};

// Auto-resolve conflict based on strategy
export const autoResolveConflict = <T extends { updated_at?: string; created_at: string }>(
  local: T,
  remote: T,
  strategy: ConflictStrategy = 'last-write-wins'
): T => {
  switch (strategy) {
    case 'local-wins':
      return resolveLocalWins(local, remote);
    case 'remote-wins':
      return resolveRemoteWins(local, remote);
    case 'last-write-wins':
      return resolveLastWriteWins(local, remote);
    default:
      throw new Error('Manual resolution required');
  }
};

// Detect if there's a conflict
export const hasConflict = <T extends { updated_at?: string; created_at: string }>(
  local: T,
  remote: T
): boolean => {
  const localTimestamp = local.updated_at || local.created_at;
  const remoteTimestamp = remote.updated_at || remote.created_at;

  // If timestamps are different, there's a potential conflict
  return localTimestamp !== remoteTimestamp;
};

// Product-specific conflict resolution
export const resolveProductConflict = (
  local: any,
  remote: any,
  strategy: ConflictStrategy = 'last-write-wins'
): any => {
  if (strategy === 'last-write-wins') {
    return resolveLastWriteWins(local, remote);
  }

  // Smart merge for products
  // - Use max stock_quantity (prefer higher inventory)
  // - Use latest sale_price
  // - Use latest cost_price
  // - Keep latest supplier info
  return resolveMerge(local, remote, {
    stock_quantity: 'max',
    sale_price: 'remote',
    cost_price: 'remote',
    supplier: 'remote',
    name: 'remote',
    barcode: 'remote',
    category_id: 'remote',
    min_stock_level: 'remote',
    description: 'remote'
  });
};

// Sale-specific conflict resolution
export const resolveSaleConflict = (
  local: any,
  remote: any,
  strategy: ConflictStrategy = 'remote-wins'
): any => {
  // Sales are typically immutable after creation
  // Prefer remote (server) version as source of truth
  return strategy === 'local-wins' ? local : remote;
};

// Category-specific conflict resolution
export const resolveCategoryConflict = (
  local: any,
  remote: any,
  strategy: ConflictStrategy = 'last-write-wins'
): any => {
  return autoResolveConflict(local, remote, strategy);
};

// Party purchase-specific conflict resolution
export const resolvePartyPurchaseConflict = (
  local: any,
  remote: any,
  strategy: ConflictStrategy = 'last-write-wins'
): any => {
  if (strategy === 'last-write-wins') {
    return resolveLastWriteWins(local, remote);
  }

  // Merge payment status intelligently
  return resolveMerge(local, remote, {
    payment_status: 'remote', // Prefer server payment status
    payment_date: 'remote',
    quantity: 'remote',
    unit_price: 'remote',
    total_amount: 'remote',
    party_name: 'remote',
    notes: 'remote'
  });
};

// Conflict resolution dispatcher
export const resolveEntityConflict = (
  entity: 'product' | 'sale' | 'category' | 'party_purchase',
  local: any,
  remote: any,
  strategy: ConflictStrategy = 'last-write-wins'
): any => {
  switch (entity) {
    case 'product':
      return resolveProductConflict(local, remote, strategy);
    case 'sale':
      return resolveSaleConflict(local, remote, strategy);
    case 'category':
      return resolveCategoryConflict(local, remote, strategy);
    case 'party_purchase':
      return resolvePartyPurchaseConflict(local, remote, strategy);
    default:
      return autoResolveConflict(local, remote, strategy);
  }
};

// Batch conflict resolution
export const resolveBatchConflicts = (
  conflicts: Conflict[],
  strategy: ConflictStrategy = 'last-write-wins'
): Map<string, any> => {
  const resolutions = new Map<string, any>();

  conflicts.forEach(conflict => {
    try {
      const resolution = resolveEntityConflict(
        conflict.entity,
        conflict.localVersion,
        conflict.remoteVersion,
        strategy
      );

      resolutions.set(`${conflict.entity}_${conflict.id}`, resolution);

      // Mark as resolved
      resolveConflict(`${conflict.entity}_${conflict.id}`, resolution);
    } catch (err) {
      console.error(`Error resolving conflict for ${conflict.entity} ${conflict.id}:`, err);
    }
  });

  return resolutions;
};

// Get conflict statistics
export const getConflictStats = () => {
  const conflicts = Array.from(conflictsStore.values());
  return {
    total: conflicts.length,
    unresolved: conflicts.filter(c => !c.resolved).length,
    resolved: conflicts.filter(c => c.resolved).length,
    byEntity: {
      product: conflicts.filter(c => c.entity === 'product').length,
      sale: conflicts.filter(c => c.entity === 'sale').length,
      category: conflicts.filter(c => c.entity === 'category').length,
      party_purchase: conflicts.filter(c => c.entity === 'party_purchase').length
    }
  };
};

// Export conflicts for debugging
export const exportConflicts = (): Conflict[] => {
  return Array.from(conflictsStore.values());
};

// Import conflicts (for testing/debugging)
export const importConflicts = (conflicts: Conflict[]): void => {
  conflicts.forEach(conflict => {
    const key = `${conflict.entity}_${conflict.id}`;
    conflictsStore.set(key, conflict);
  });
};

// Clear all conflicts
export const clearAllConflicts = (): void => {
  conflictsStore.clear();
};
