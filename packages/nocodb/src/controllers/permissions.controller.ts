import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PermissionsService, PermissionCreatePayload, PermissionUpdatePayload } from '~/services/permissions.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { PermissionEntity, PermissionKey, PermissionOptionValue, PermissionGrantedType, PermissionRole } from 'nocodb-sdk';

export interface TablePermissionsPayload {
  permissions: Record<PermissionKey, {
    granted_type: string;
    granted_role?: string;
    subjects?: Array<{ type: 'user' | 'group'; id: string }>;
  }>;
}

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/tables/:tableId/permissions',
    '/api/v2/meta/bases/:baseId/tables/:tableId/permissions',
  ])
  @Acl('tableGet')
  async getTablePermissions(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Param('baseId') baseId: string,
  ) {
    return await this.permissionsService.getTablePermissions(context, {
      baseId,
      tableId,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/tables/:tableId/permissions',
    '/api/v2/meta/bases/:baseId/tables/:tableId/permissions',
  ])
  @HttpCode(200)
  @Acl('tableUpdate')
  async saveTablePermissions(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Param('baseId') baseId: string,
    @Body() body: TablePermissionsPayload,
    @Req() req: NcRequest,
  ) {
    // Convert frontend permission values to backend format
    const convertedPermissions: Record<PermissionKey, {
      granted_type: PermissionGrantedType;
      granted_role?: PermissionRole;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    }> = {} as Record<PermissionKey, {
      granted_type: PermissionGrantedType;
      granted_role?: PermissionRole;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    }>;

    for (const [permissionKey, permissionData] of Object.entries(body.permissions)) {
      const { granted_type, granted_role, subjects } = permissionData;
      
      // Convert permission option values to backend format
      let backendGrantedType: PermissionGrantedType;
      let backendGrantedRole: PermissionRole | undefined;

      if (granted_type === 'editors_and_up') {
        backendGrantedType = PermissionGrantedType.ROLE;
        backendGrantedRole = PermissionRole.EDITOR;
      } else if (granted_type === 'creators_and_up') {
        backendGrantedType = PermissionGrantedType.ROLE;
        backendGrantedRole = PermissionRole.CREATOR;
      } else if (granted_type === 'viewers_and_up') {
        backendGrantedType = PermissionGrantedType.ROLE;
        backendGrantedRole = PermissionRole.VIEWER;
      } else if (granted_type === 'specific_users') {
        backendGrantedType = PermissionGrantedType.USER;
      } else if (granted_type === 'nobody') {
        backendGrantedType = PermissionGrantedType.NOBODY;
      } else {
        backendGrantedType = PermissionGrantedType.ROLE;
        backendGrantedRole = PermissionRole.EDITOR;
      }

      convertedPermissions[permissionKey as PermissionKey] = {
        granted_type: backendGrantedType,
        granted_role: backendGrantedRole,
        subjects,
      };
    }

    return await this.permissionsService.saveTablePermissions(context, {
      baseId,
      tableId,
      permissions: convertedPermissions,
      user: req.user,
      req,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/permissions',
    '/api/v2/meta/bases/:baseId/permissions',
  ])
  @HttpCode(200)
  @Acl('baseUpdate')
  async createPermission(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: PermissionCreatePayload,
    @Req() req: NcRequest,
  ) {
    return await this.permissionsService.createPermission(context, {
      baseId,
      permission: body,
      user: req.user,
      req,
    });
  }

  @Put([
    '/api/v1/db/meta/projects/:baseId/permissions/:permissionId',
    '/api/v2/meta/bases/:baseId/permissions/:permissionId',
  ])
  @HttpCode(200)
  @Acl('baseUpdate')
  async updatePermission(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('permissionId') permissionId: string,
    @Body() body: PermissionUpdatePayload,
    @Req() req: NcRequest,
  ) {
    return await this.permissionsService.updatePermission(context, {
      permissionId,
      baseId,
      permission: body,
      user: req.user,
      req,
    });
  }

  @Delete([
    '/api/v1/db/meta/projects/:baseId/permissions/:permissionId',
    '/api/v2/meta/bases/:baseId/permissions/:permissionId',
  ])
  @HttpCode(200)
  @Acl('baseUpdate')
  async deletePermission(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: NcRequest,
  ) {
    return await this.permissionsService.deletePermission(context, {
      permissionId,
      baseId,
      user: req.user,
      req,
    });
  }
}
