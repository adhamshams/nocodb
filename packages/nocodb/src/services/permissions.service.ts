import { Injectable, Logger } from '@nestjs/common';
import { NcContext, NcRequest } from '~/interface/config';
import { Permission } from '~/models';
import { PermissionEntity, PermissionGrantedType, PermissionKey, PermissionRole } from 'nocodb-sdk';
import Noco from '~/Noco';
import { nanoid } from 'nanoid';
import { MetaTable } from '~/utils/globals';

export interface PermissionCreatePayload {
  entity: PermissionEntity;
  entity_id: string;
  permission: PermissionKey;
  granted_type: PermissionGrantedType;
  granted_role?: PermissionRole;
  enforce_for_form?: boolean;
  enforce_for_automation?: boolean;
  subjects?: Array<{ type: 'user' | 'group'; id: string }>;
}

export interface PermissionUpdatePayload {
  granted_type: PermissionGrantedType;
  granted_role?: PermissionRole;
  enforce_for_form?: boolean;
  enforce_for_automation?: boolean;
  subjects?: Array<{ type: 'user' | 'group'; id: string }>;
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  async createPermission(
    context: NcContext,
    param: {
      baseId: string;
      permission: PermissionCreatePayload;
      user: any;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const permissionId = nanoid(20);
    
    const permissionData = {
      id: permissionId,
      fk_workspace_id: context.workspace_id,
      base_id: param.baseId,
      entity: param.permission.entity,
      entity_id: param.permission.entity_id,
      permission: param.permission.permission,
      created_by: param.user.id,
      enforce_for_form: param.permission.enforce_for_form ?? true,
      enforce_for_automation: param.permission.enforce_for_automation ?? true,
      granted_type: param.permission.granted_type,
      granted_role: param.permission.granted_role,
    };

    // Insert permission
    await ncMeta.metaInsert2(context.workspace_id, param.baseId, MetaTable.PERMISSIONS, permissionData);

    // Insert subjects if provided
    if (param.permission.subjects && param.permission.subjects.length > 0) {
      for (const subject of param.permission.subjects) {
        await ncMeta.metaInsert2(context.workspace_id, param.baseId, MetaTable.PERMISSION_SUBJECTS, {
          fk_permission_id: permissionId,
          subject_type: subject.type,
          subject_id: subject.id,
          fk_workspace_id: context.workspace_id,
          base_id: param.baseId,
        }, true); // ignoreIdGeneration = true
      }
    }

    return { id: permissionId, ...permissionData };
  }

  async updatePermission(
    context: NcContext,
    param: {
      permissionId: string;
      baseId: string;
      permission: PermissionUpdatePayload;
      user: any;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const updateData = {
      granted_type: param.permission.granted_type,
      granted_role: param.permission.granted_role,
      enforce_for_form: param.permission.enforce_for_form,
      enforce_for_automation: param.permission.enforce_for_automation,
    };

    try {
      // Update permission
      await ncMeta.metaUpdate(
        context.workspace_id,
        param.baseId,
        MetaTable.PERMISSIONS,
        updateData,
        param.permissionId,
      );
      
    } catch (error) {
      console.error('❌ Permission update failed:', error);
      throw error;
    }

    // Update subjects if provided
    if (param.permission.subjects !== undefined) {
      try {
        await ncMeta.metaDelete(
          context.workspace_id,
          param.baseId,
          MetaTable.PERMISSION_SUBJECTS,
          { fk_permission_id: param.permissionId },
        );
      } catch (error) {
        console.error('❌ Delete subjects failed:', error);
        throw error;
      }

      // Insert new subjects
      if (param.permission.subjects.length > 0) {
        
        for (let i = 0; i < param.permission.subjects.length; i++) {
          const subject = param.permission.subjects[i];
          
          try {
            await ncMeta.metaInsert2(context.workspace_id, param.baseId, MetaTable.PERMISSION_SUBJECTS, {
              fk_permission_id: param.permissionId,
              subject_type: subject.type,
              subject_id: subject.id,
              fk_workspace_id: context.workspace_id,
              base_id: param.baseId,
            }, true); // ignoreIdGeneration = true
            console.log(`✅ Subject ${i + 1} inserted successfully`);
          } catch (error) {
            console.error(`❌ Failed to insert subject ${i + 1}:`, error);
            throw error;
          }
        }
      }
    }

    return { id: param.permissionId, ...updateData };
  }

  async deletePermission(
    context: NcContext,
    param: {
      permissionId: string;
      baseId: string;
      user: any;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // Delete subjects first
    await ncMeta.metaDelete(
      context.workspace_id,
      param.baseId,
      MetaTable.PERMISSION_SUBJECTS,
      { fk_permission_id: param.permissionId },
    );

    // Delete permission
    await ncMeta.metaDelete(
      context.workspace_id,
      param.baseId,
      MetaTable.PERMISSIONS,
      param.permissionId,
    );

    return { id: param.permissionId };
  }

  async getTablePermissions(
    context: NcContext,
    param: {
      baseId: string;
      tableId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const permissions = await ncMeta.metaList2(context.workspace_id, param.baseId, MetaTable.PERMISSIONS, {
      condition: {
        base_id: param.baseId,
        entity: PermissionEntity.TABLE,
        entity_id: param.tableId,
      },
    });

    // Get subjects for each permission
    for (const permission of permissions) {
      const subjects = await ncMeta.metaList2(context.workspace_id, param.baseId, MetaTable.PERMISSION_SUBJECTS, {
        condition: {
          fk_permission_id: permission.id,
        },
      });
      permission.subjects = subjects.map(s => ({
        type: s.subject_type,
        id: s.subject_id,
      }));
    }

    return permissions;
  }

  async saveTablePermissions(
    context: NcContext,
    param: {
      baseId: string;
      tableId: string;
      permissions: Record<PermissionKey, {
        granted_type: PermissionGrantedType;
        granted_role?: PermissionRole;
        subjects?: Array<{ type: 'user' | 'group'; id: string }>;
      }>;
      user: any;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // Get existing permissions for this table
    const existingPermissions = await this.getTablePermissions(context, {
      baseId: param.baseId,
      tableId: param.tableId,
    });

    // Create a map of existing permissions by permission type
    const existingPermissionsMap = new Map();
    for (const perm of existingPermissions) {
      existingPermissionsMap.set(perm.permission, perm);
    }

    const results = [];

    // Process each permission type
    for (const [permissionKey, permissionData] of Object.entries(param.permissions)) {
      console.log(`🔍 Processing permission: ${permissionKey}`, {
        granted_type: permissionData.granted_type,
        subjects: permissionData.subjects
      });
      
      const existingPermission = existingPermissionsMap.get(permissionKey);

      if (existingPermission) {
        // Update existing permission
        const result = await this.updatePermission(context, {
          permissionId: existingPermission.id,
          baseId: param.baseId,
          permission: permissionData,
          user: param.user,
          req: param.req,
        }, ncMeta);
        results.push(result);
      } else {
        // Create new permission
        const result = await this.createPermission(context, {
          baseId: param.baseId,
          permission: {
            entity: PermissionEntity.TABLE,
            entity_id: param.tableId,
            permission: permissionKey as PermissionKey,
            ...permissionData,
          },
          user: param.user,
          req: param.req,
        }, ncMeta);
        results.push(result);
      }
    }

    return results;
  }
}
