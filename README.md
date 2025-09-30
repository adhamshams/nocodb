# NocoDB - Enhanced with Table-Level Permissions

<div align="center">
  <img src="./packages/nc-gui/assets/img/icons/512x512.png" width="80" />
  <h3>The Open Source Airtable Alternative</h3>
  <p>Enhanced with comprehensive table-level record permissions</p>
</div>

## 🚀 What's New

This enhanced version of NocoDB includes **comprehensive table-level record permissions** that provide granular access control over who can view, create, update, and delete records in each table.

### ✨ New Permission Features

- **📖 VIEW Permissions**: Control who can view/read records in tables
- **➕ CREATE Permissions**: Control who can create new records  
- **✏️ UPDATE Permissions**: Control who can modify existing records
- **🗑️ DELETE Permissions**: Control who can delete records

### 🎯 Permission Options

For each permission type, you can configure:

- **Nobody**: No access at all
- **Viewers & up**: All users with Viewer role or higher
- **Editors & up**: Users with Editor, Creator, or Owner roles  
- **Creators & up**: Users with Creator or Owner roles only
- **Specific users**: Custom selection of individual users

### 🔧 Technical Enhancements

- **Frontend**: New permission configuration modal in table settings
- **Backend**: Comprehensive API protection across all record operations
- **SDK**: Enhanced permission types and validation utilities
- **Database**: Proper permission storage and inheritance system

## 🛠️ Development Setup

### Prerequisites

- Node.js >= 16.14.0
- pnpm package manager

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd nocodb

# Install all dependencies including SDK build
# Run from the project root
pnpm bootstrap

# Start the frontend development server
# Run from the project root  
pnpm start:frontend
# Frontend runs on http://localhost:3000

# Start the backend development server (in a new terminal)
# Run from the project root
pnpm start:backend  
# Backend runs on http://localhost:8080
```

### Development Commands

```bash
# Install dependencies and build packages
pnpm bootstrap

# Start frontend only
pnpm start:frontend

# Start backend only  
pnpm start:backend

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

## 📋 Permission System Usage

### Setting Up Table Permissions

1. **Access Table Settings**: Click on the table menu and select "Table Permissions"

2. **Configure View Permissions**: 
   - Default: "Viewers & up" (most permissive since viewing is basic)
   - Set to "Nobody" to make table completely private
   - Use "Specific users" for custom access control

3. **Configure Create/Update/Delete**: 
   - Default: "Editors & up" 
   - Customize based on your workflow needs
   - UPDATE permissions automatically inherit CREATE permissions for consistency

### Permission Hierarchy

```
OWNER (5) > CREATOR (4) > EDITOR (3) > COMMENTER (2) > VIEWER (1) > NO_ACCESS (0)
```

### Example Scenarios

**📝 Content Management Table**
- VIEW: "Viewers & up" (everyone can read)
- CREATE: "Editors & up" (editors can add content)
- UPDATE: "Editors & up" (editors can modify)  
- DELETE: "Creators & up" (only senior roles can delete)

**🔒 Sensitive HR Table**
- VIEW: "Specific users" (only HR team)
- CREATE: "Specific users" (only HR managers)
- UPDATE: "Specific users" (only HR managers)
- DELETE: "Nobody" (preserve audit trail)

**📊 Public Dashboard Table**
- VIEW: "Viewers & up" (everyone can see)
- CREATE: "Nobody" (read-only data)
- UPDATE: "Nobody" (read-only data)
- DELETE: "Nobody" (read-only data)

## 🔐 Security Features

### Backend Protection

All record operations are protected at the API level:

- **GET** `/api/v2/tables/:tableId/records` - VIEW permission required
- **POST** `/api/v2/tables/:tableId/records` - CREATE permission required  
- **PATCH** `/api/v2/tables/:tableId/records/:recordId` - UPDATE permission required
- **DELETE** `/api/v2/tables/:tableId/records/:recordId` - DELETE permission required

### Error Handling

Clear error messages when access is denied:

```json
{
  "error": "FORBIDDEN",
  "message": "Access denied: 'viewer' role does not have permission to create records in this table",
  "statusCode": 403
}
```

### Audit Trail

All permission changes and access attempts are logged for security monitoring.

## 📚 Architecture

### Frontend Components

- **Permissions Modal**: `/packages/nc-gui/components/dlg/Table/Permissions.vue`
- **Permission Composables**: `/packages/nc-gui/composables/usePermissions.ts`
- **SDK Integration**: Uses nocodb-sdk permission utilities

### Backend Services

- **Permission Utilities**: `/packages/nocodb/src/utils/tablePermissions.ts`
- **Data Services**: All CRUD operations validate permissions
- **Controllers**: Pass authentication context to services

### Database Schema

- **Permissions Table**: Stores table-level permission configurations
- **Permission Subjects**: Links permissions to specific users/roles
- **Audit Logs**: Tracks permission changes and access

## 🤝 Contributing

When contributing to this enhanced version:

1. **Permission Changes**: Test all permission scenarios
2. **API Changes**: Ensure permission validation is included
3. **Frontend Changes**: Update permission UI accordingly
4. **Documentation**: Update relevant guides

## 📖 Original NocoDB

This is an enhanced version of [NocoDB](https://github.com/nocodb/nocodb), the open-source Airtable alternative. All original features and capabilities are preserved while adding comprehensive permission management.

For the original documentation, visit: [https://docs.nocodb.com/](https://docs.nocodb.com/)

## 📄 License

This project maintains the same license as the original NocoDB project - AGPLv3.

## 🙏 Acknowledgments

- Original NocoDB team for the excellent foundation
- Community contributors who helped shape the permission system
- Users who provided feedback on access control requirements

---

**Ready to get started?** Run `pnpm bootstrap` and then `pnpm start:frontend` to begin developing! 🚀
