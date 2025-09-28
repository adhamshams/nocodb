import type {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default class Permission {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  entity: PermissionEntity;
  entity_id: string;
  permission: PermissionKey;
  created_by: string;
  enforce_for_form: boolean;
  enforce_for_automation: boolean;
  granted_type: PermissionGrantedType;
  granted_role: PermissionRole;

  subjects?: {
    type: 'user' | 'group';
    id: string;
  }[];

  constructor(permission: Permission) {
    Object.assign(this, permission);
  }
  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Permission[]> {
    const permissions = await ncMeta.metaList2(context.workspace_id, baseId, 'nc_permissions', {
      condition: {
        base_id: baseId,
      },
    });

    // Get subjects for each permission
    for (const permission of permissions) {
      const subjects = await ncMeta.metaList2(context.workspace_id, baseId, 'nc_permission_subjects', {
        condition: {
          fk_permission_id: permission.id,
        },
      });
      permission.subjects = subjects.map(s => ({
        type: s.subject_type,
        id: s.subject_id,
      }));
    }

    return permissions.map(p => new Permission(p));
  }

  public static async getByEntity(
    context: NcContext,
    baseId: string,
    entity: PermissionEntity,
    entityId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Permission[]> {
    const permissions = await ncMeta.metaList2(context.workspace_id, baseId, 'nc_permissions', {
      condition: {
        base_id: baseId,
        entity,
        entity_id: entityId,
      },
    });

    // Get subjects for each permission
    for (const permission of permissions) {
      const subjects = await ncMeta.metaList2(context.workspace_id, baseId, 'nc_permission_subjects', {
        condition: {
          fk_permission_id: permission.id,
        },
      });
      permission.subjects = subjects.map(s => ({
        type: s.subject_type,
        id: s.subject_id,
      }));
    }

    return permissions.map(p => new Permission(p));
  }
}
