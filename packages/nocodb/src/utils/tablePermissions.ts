import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
  ProjectRoles,
} from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { Permission } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';

/**
 * Role hierarchy power mapping (higher number = more powerful role)
 */
const ROLE_POWER: Record<string, number> = {
  [ProjectRoles.NO_ACCESS]: 0,
  [ProjectRoles.VIEWER]: 1,
  [ProjectRoles.COMMENTER]: 2,
  [ProjectRoles.EDITOR]: 3,
  [ProjectRoles.CREATOR]: 4,
  [ProjectRoles.OWNER]: 5,
};

/**
 * Get the highest role power from user's base roles
 */
function getUserRolePower(baseRoles: Record<string, boolean>): number {
  let maxPower = 0;
  for (const [role, hasRole] of Object.entries(baseRoles)) {
    if (hasRole && ROLE_POWER[role] !== undefined) {
      maxPower = Math.max(maxPower, ROLE_POWER[role]);
    }
  }
  return maxPower;
}

/**
 * Get the user's highest project role
 */
function getUserHighestRole(baseRoles: Record<string, boolean>): ProjectRoles {
  let highestRole = ProjectRoles.NO_ACCESS;
  let maxPower = 0;
  
  for (const [role, hasRole] of Object.entries(baseRoles)) {
    if (hasRole && ROLE_POWER[role] !== undefined && ROLE_POWER[role] > maxPower) {
      maxPower = ROLE_POWER[role];
      highestRole = role as ProjectRoles;
    }
  }
  
  return highestRole;
}

/**
 * Check if a user has permission to create records in a table
 * @param context - NocoDB context
 * @param tableId - Table ID to check permissions for
 * @param userBaseRoles - User's base roles from req.user.base_roles
 * @param userId - User ID for specific user permissions
 * @returns Promise<boolean> - true if user has create permission, false otherwise
 */
export async function checkTableCreatePermission(
  context: NcContext,
  tableId: string,
  userBaseRoles: Record<string, boolean>,
  userId?: string
): Promise<boolean> {
  try {
    // Get table permissions for CREATE operation
    const tablePermissions = await Permission.getByEntity(
      context,
      context.base_id,
      PermissionEntity.TABLE,
      tableId
    );

    // Find CREATE permission specifically
    const createPermission = tablePermissions.find(
      (p) => p.permission === PermissionKey.TABLE_RECORD_ADD
    );

    // If no specific CREATE permission is set, use default behavior (Editors & up can create)
    if (!createPermission) {
      const userRolePower = getUserRolePower(userBaseRoles);
      return userRolePower >= ROLE_POWER[ProjectRoles.EDITOR];
    }

    // Check permission based on granted type
    switch (createPermission.granted_type) {
      case PermissionGrantedType.NOBODY:
        // Nobody can create records
        return false;

      case PermissionGrantedType.ROLE:
        // Role-based permission (e.g., "Editors & up", "Creators & up", "Viewers & up")
        const requiredRolePower = ROLE_POWER[createPermission.granted_role] || ROLE_POWER[ProjectRoles.EDITOR];
        const userRolePower = getUserRolePower(userBaseRoles);
        return userRolePower >= requiredRolePower;

      case PermissionGrantedType.USER:
        // Specific users only
        if (!userId || !createPermission.subjects) {
          return false;
        }
        return createPermission.subjects.some(
          (subject) => subject.type === 'user' && subject.id === userId
        );

      default:
        // Default to editor permission if permission type is unknown
        const defaultUserRolePower = getUserRolePower(userBaseRoles);
        return defaultUserRolePower >= ROLE_POWER[ProjectRoles.EDITOR];
    }
  } catch (error) {
    // If there's an error fetching permissions, default to editor permission for safety
    console.warn('Error checking table create permission:', error);
    const userRolePower = getUserRolePower(userBaseRoles);
    return userRolePower >= ROLE_POWER[ProjectRoles.EDITOR];
  }
}

/**
 * Validate that a user has permission to create records in a table, throwing an error if not
 * @param context - NocoDB context
 * @param tableId - Table ID to check permissions for  
 * @param req - Request object containing user information
 * @throws NcError.forbidden if user doesn't have permission
 */
export async function validateTableCreatePermission(
  context: NcContext,
  tableId: string,
  req: NcRequest
): Promise<void> {
  const userBaseRoles = req.user?.base_roles || {};
  const userId = req.user?.id;

  const hasPermission = await checkTableCreatePermission(
    context,
    tableId,
    userBaseRoles,
    userId
  );

  if (!hasPermission) {
    const userRole = getUserHighestRole(userBaseRoles);
    NcError.forbidden(
      `Access denied: '${userRole}' role does not have permission to create records in this table`
    );
  }
}

/**
 * Check if a user has permission to delete records in a table
 * @param context - NocoDB context
 * @param tableId - Table ID to check permissions for
 * @param userBaseRoles - User's base roles from req.user.base_roles
 * @param userId - User ID for specific user permissions
 * @returns Promise<boolean> - true if user has delete permission, false otherwise
 */
export async function checkTableDeletePermission(
  context: NcContext,
  tableId: string,
  userBaseRoles: Record<string, boolean>,
  userId?: string
): Promise<boolean> {
  try {
    // Get table permissions for DELETE operation
    const tablePermissions = await Permission.getByEntity(
      context,
      context.base_id,
      PermissionEntity.TABLE,
      tableId
    );

    // Find DELETE permission specifically
    const deletePermission = tablePermissions.find(
      (p) => p.permission === PermissionKey.TABLE_RECORD_DELETE
    );

    // If no specific DELETE permission is set, use default behavior (Editors & up can delete)
    if (!deletePermission) {
      const userRolePower = getUserRolePower(userBaseRoles);
      return userRolePower >= ROLE_POWER[ProjectRoles.EDITOR];
    }

    // Check permission based on granted type
    switch (deletePermission.granted_type) {
      case PermissionGrantedType.NOBODY:
        // Nobody can delete records
        return false;

      case PermissionGrantedType.ROLE:
        // Role-based permission (e.g., "Editors & up", "Creators & up", "Viewers & up")
        const requiredRolePower = ROLE_POWER[deletePermission.granted_role] || ROLE_POWER[ProjectRoles.EDITOR];
        const userRolePower = getUserRolePower(userBaseRoles);
        return userRolePower >= requiredRolePower;

      case PermissionGrantedType.USER:
        // Specific users only
        if (!userId || !deletePermission.subjects) {
          return false;
        }
        return deletePermission.subjects.some(
          (subject) => subject.type === 'user' && subject.id === userId
        );

      default:
        // Default to editor permission if permission type is unknown
        const defaultUserRolePower = getUserRolePower(userBaseRoles);
        return defaultUserRolePower >= ROLE_POWER[ProjectRoles.EDITOR];
    }
  } catch (error) {
    // If there's an error fetching permissions, default to editor permission for safety
    console.warn('Error checking table delete permission:', error);
    const userRolePower = getUserRolePower(userBaseRoles);
    return userRolePower >= ROLE_POWER[ProjectRoles.EDITOR];
  }
}

/**
 * Validate that a user has permission to delete records in a table, throwing an error if not
 * @param context - NocoDB context
 * @param tableId - Table ID to check permissions for  
 * @param req - Request object containing user information
 * @throws NcError.forbidden if user doesn't have permission
 */
export async function validateTableDeletePermission(
  context: NcContext,
  tableId: string,
  req: NcRequest
): Promise<void> {
  const userBaseRoles = req.user?.base_roles || {};
  const userId = req.user?.id;

  const hasPermission = await checkTableDeletePermission(
    context,
    tableId,
    userBaseRoles,
    userId
  );

  if (!hasPermission) {
    const userRole = getUserHighestRole(userBaseRoles);
    NcError.forbidden(
      `Access denied: '${userRole}' role does not have permission to delete records in this table`
    );
  }
}

/**
 * Check if user has table record update permission
 * Reuses the same permission logic as CREATE for consistency
 */
export async function checkTableUpdatePermission(
  context: NcContext,
  tableId: string,
  userBaseRoles: Record<string, boolean>,
  userId?: string
): Promise<boolean> {
  // Reuse the CREATE permission check for updates
  return await checkTableCreatePermission(context, tableId, userBaseRoles, userId);
}

/**
 * Validate table record update permission (throws error if not allowed)
 * Reuses the same permission logic as CREATE for consistency
 */
export async function validateTableUpdatePermission(
  context: NcContext,
  tableId: string,
  req: NcRequest
): Promise<void> {
  // Reuse the CREATE permission validation for updates
  await validateTableCreatePermission(context, tableId, req);
}

/**
 * Check if a user has permission to view records in a table
 * @param context - NocoDB context
 * @param tableId - Table ID to check permissions for
 * @param userBaseRoles - User's base roles from req.user.base_roles
 * @param userId - User ID for specific user permissions
 * @returns Promise<boolean> - true if user has view permission, false otherwise
 */
export async function checkTableViewPermission(
  context: NcContext,
  tableId: string,
  userBaseRoles: Record<string, boolean>,
  userId?: string
): Promise<boolean> {
  try {
    // Get table permissions for VIEW operation
    const tablePermissions = await Permission.getByEntity(
      context,
      context.base_id,
      PermissionEntity.TABLE,
      tableId
    );

    // Find VIEW permission specifically
    const viewPermission = tablePermissions.find(
      (p) => p.permission === PermissionKey.TABLE_RECORD_VIEW
    );

    // If no specific VIEW permission is set, use default behavior (Viewers & up can view)
    if (!viewPermission) {
      const userRolePower = getUserRolePower(userBaseRoles);
      return userRolePower >= ROLE_POWER[ProjectRoles.VIEWER];
    }

    // Check permission based on granted type
    switch (viewPermission.granted_type) {
      case PermissionGrantedType.NOBODY:
        // Nobody can view records
        return false;

      case PermissionGrantedType.ROLE:
        // Role-based permission (e.g., "Editors & up", "Creators & up", "Viewers & up")
        const requiredRolePower = ROLE_POWER[viewPermission.granted_role] || ROLE_POWER[ProjectRoles.VIEWER];
        const userRolePower = getUserRolePower(userBaseRoles);
        return userRolePower >= requiredRolePower;

      case PermissionGrantedType.USER:
        // Specific users only
        if (!userId || !viewPermission.subjects) {
          return false;
        }
        return viewPermission.subjects.some(
          (subject) => subject.type === 'user' && subject.id === userId
        );

      default:
        // Default to viewer permission if permission type is unknown
        const defaultUserRolePower = getUserRolePower(userBaseRoles);
        return defaultUserRolePower >= ROLE_POWER[ProjectRoles.VIEWER];
    }
  } catch (error) {
    // If there's an error fetching permissions, default to viewer permission for safety
    console.warn('Error checking table view permission:', error);
    const userRolePower = getUserRolePower(userBaseRoles);
    return userRolePower >= ROLE_POWER[ProjectRoles.VIEWER];
  }
}

/**
 * Validate that a user has permission to view records in a table, throwing an error if not
 * @param context - NocoDB context
 * @param tableId - Table ID to check permissions for  
 * @param req - Request object containing user information
 * @throws NcError.forbidden if user doesn't have permission
 */
export async function validateTableViewPermission(
  context: NcContext,
  tableId: string,
  req: NcRequest
): Promise<void> {
  const userBaseRoles = req.user?.base_roles || {};
  const userId = req.user?.id;

  const hasPermission = await checkTableViewPermission(
    context,
    tableId,
    userBaseRoles,
    userId
  );

  if (!hasPermission) {
    const userRole = getUserHighestRole(userBaseRoles);
    NcError.forbidden(
      `Access denied: '${userRole}' role does not have permission to view records in this table`
    );
  }
}