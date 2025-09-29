<script lang="ts" setup>
import type { PermissionKey, PermissionOptionValue } from 'nocodb-sdk'
import { PermissionMeta, PermissionOptions, getPermissionIcon, getPermissionLabel } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  tableId: string
  title?: string
  baseId?: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

const { permissionsByEntity, getPermissionSummary } = usePermissions()

// Get base store and users
const basesStore = useBases()
const { basesUser } = storeToRefs(basesStore)
const { getBaseUsers } = basesStore

// Get current base ID from multiple sources
const route = useRoute()

const baseId = computed(() => {
  // Use explicit prop if provided
  if (props.baseId) {
    return props.baseId
  }
  
  // Try route params (most common case)
  if (route.params?.baseId) {
    return route.params.baseId as string
  }
  
  // Log warning if no base ID found
  console.warn('No base ID available for permissions modal')
  return null
})

// Table permissions that we support
const tablePermissions = [
  'TABLE_RECORD_ADD',
  'TABLE_RECORD_DELETE'
] as PermissionKey[]

const isLoading = ref(false)
const isLoadingUsers = ref(false)

// Default permission data - matching documentation defaults
const permissions = ref<Record<PermissionKey, PermissionOptionValue>>({
  TABLE_RECORD_ADD: 'editors_and_up' as PermissionOptionValue,
  TABLE_RECORD_DELETE: 'editors_and_up' as PermissionOptionValue,
})

// Selected users for specific permissions
const selectedUsers = ref<Record<PermissionKey, string[]>>({
  TABLE_RECORD_ADD: [],
  TABLE_RECORD_DELETE: [],
})

// Base users computed from store
const baseUsers = computed(() => {
  const currentBaseId = baseId.value
  if (!currentBaseId) return []
  return basesUser.value?.get(currentBaseId) || []
})

// User search functionality
const userSearchQuery = ref('')
const filteredUsers = computed(() => {
  if (!userSearchQuery.value) return baseUsers.value
  
  const query = userSearchQuery.value.toLowerCase()
  return baseUsers.value.filter(user => 
    user.email?.toLowerCase().includes(query) ||
    user.display_name?.toLowerCase().includes(query) ||
    `${user.firstname || ''} ${user.lastname || ''}`.toLowerCase().includes(query)
  )
})

// Helper function to get user initials
const getUserInitials = (user: User | null | undefined) => {
  if (!user) return 'U'
  
  if (user.display_name) {
    return user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }
  if (user.firstname && user.lastname) {
    return `${user.firstname[0]}${user.lastname[0]}`.toUpperCase()
  }
  if (user.email) {
    return user.email.slice(0, 2).toUpperCase()
  }
  return 'U'
}

// Helper function to get user display name
const getUserDisplayName = (user: User | null | undefined) => {
  if (!user) return 'Unknown User'
  return user.display_name || `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email || 'Unknown User'
}

// Helper function to get user role
const getUserRole = (user: User | null | undefined) => {
  if (!user) return 'Member'
  
  // Get the highest role from base_roles
  const roles = user.base_roles || {}
  if (roles.owner) return 'Owner'
  if (roles.creator) return 'Creator'  
  if (roles.editor) return 'Editor'
  if (roles.commenter) return 'Commenter'
  if (roles.viewer) return 'Viewer'
  return 'Member'
}

// Helper function to get avatar color based on user ID
const getUserAvatarColor = (userId: string) => {
  const colors = [
    'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-orange-600', 
    'bg-red-600', 'bg-indigo-600', 'bg-pink-600', 'bg-teal-600',
    'bg-amber-600', 'bg-cyan-600'
  ]
  const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[index]
}

// Helper function to get selected option display
const getSelectedOptionDisplay = (permissionKey: PermissionKey) => {
  const selectedValue = permissions.value[permissionKey]
  const option = PermissionOptions.find(opt => opt.value === selectedValue)
  if (!option) return ''
  
  return {
    icon: option.icon,
    label: option.label,
    style: getPermissionOptionStyle(selectedValue)
  }
}

// Helper function to get permission option colors and styles
const getPermissionOptionStyle = (optionValue: PermissionOptionValue) => {
  switch (optionValue) {
    case 'creators_and_up':
      return {
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-700'
      }
    case 'editors_and_up':
      return {
        iconColor: 'text-green-500',
        bgColor: 'bg-green-50', 
        borderColor: 'border-green-200',
        textColor: 'text-green-700'
      }
    case 'viewers_and_up':
      return {
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200', 
        textColor: 'text-blue-700'
      }
    case 'specific_users':
      return {
        iconColor: 'text-purple-500',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-700'
      }
    case 'nobody':
      return {
        iconColor: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-700'
      }
    default:
      return {
        iconColor: 'text-gray-500',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-700'
      }
  }
}

// Load base users when component mounts or baseId changes
const loadUsers = async () => {
  const currentBaseId = baseId.value
  if (!currentBaseId) {
    console.warn('No base ID available for loading users')
    return
  }
  
  if (isLoadingUsers.value) return // Prevent duplicate requests
  
  isLoadingUsers.value = true
  try {
    await getBaseUsers({ baseId: currentBaseId })
  } catch (error) {
    console.error('Failed to load base users:', error)
    // Don't show error to user for now, just log it
  } finally {
    isLoadingUsers.value = false
  }
}

// Load existing permissions from backend
const loadPermissions = async () => {
  const currentBaseId = baseId.value
  if (!currentBaseId) {
    console.warn('No base ID available for loading permissions')
    return
  }
  
  if (isLoading.value) return // Prevent duplicate requests
  
  isLoading.value = true
  try {
    const { $api } = useNuxtApp()
    const response = await $api.instance.get(`/api/v2/meta/bases/${currentBaseId}/tables/${props.tableId}/permissions`)
    
    // Reset to defaults first
    permissions.value = {
      TABLE_RECORD_ADD: 'editors_and_up' as PermissionOptionValue,
      TABLE_RECORD_DELETE: 'editors_and_up' as PermissionOptionValue,
    }
    selectedUsers.value = {
      TABLE_RECORD_ADD: [],
      TABLE_RECORD_DELETE: [],
    }
    
    // If we have existing permissions, load them
    if (response.data && Array.isArray(response.data)) {
      for (const permission of response.data) {
        const permissionKey = permission.permission as PermissionKey
        if (tablePermissions.includes(permissionKey)) {
          // Convert backend permission to frontend format
          let frontendValue: PermissionOptionValue
          let subjects: string[] = []
          
          if (permission.granted_type === 'user') {
            frontendValue = 'specific_users'
            subjects = permission.subjects?.map(s => s.id) || []
          } else if (permission.granted_type === 'role') {
            if (permission.granted_role === 'editor') {
              frontendValue = 'editors_and_up'
            } else if (permission.granted_role === 'creator') {
              frontendValue = 'creators_and_up'
            } else if (permission.granted_role === 'viewer') {
              frontendValue = 'viewers_and_up'
            } else {
              frontendValue = 'editors_and_up' // default
            }
          } else if (permission.granted_type === 'nobody') {
            frontendValue = 'nobody'
          } else {
            frontendValue = 'editors_and_up' // default
          }
          
          permissions.value[permissionKey] = frontendValue
          selectedUsers.value[permissionKey] = [...new Set(permission.subjects?.map(s => s.id) || [])]
        }
      }
    }
  } catch (error) {
    console.error('Failed to load permissions:', error)
    // Keep default permissions if loading fails
  } finally {
    isLoading.value = false
  }
}

// Load users when modal becomes visible
watch(visible, async (isVisible) => {
  if (isVisible && baseId.value) {
    await Promise.all([loadUsers(), loadPermissions()])
  }
})

// Load users and permissions immediately if modal is already visible
onMounted(() => {
  if (visible.value && baseId.value) {
    loadUsers()
    loadPermissions()
  }
})

const updatePermission = (permissionKey: PermissionKey, value: PermissionOptionValue) => {
  permissions.value[permissionKey] = value
  if (value !== 'specific_users') {
    selectedUsers.value[permissionKey] = []
  }
  $e('a:table:permissions:update', { permission: permissionKey, value })
}

const toggleUserSelection = (permissionKey: PermissionKey, userId: string) => {
  const users = selectedUsers.value[permissionKey]
  const index = users.indexOf(userId)
  if (index > -1) {
    users.splice(index, 1)
  } else if (!users.includes(userId)) { // Extra safety check
    users.push(userId)
  }
}

const selectAllUsers = (permissionKey: PermissionKey) => {
  selectedUsers.value[permissionKey] = baseUsers.value.map(u => u.id)
}

const clearAllUsers = (permissionKey: PermissionKey) => {
  selectedUsers.value[permissionKey] = []
}

const onSave = async () => {
  isLoading.value = true
  try {
    const currentBaseId = baseId.value
    if (!currentBaseId) {
      message.error('No base ID available')
      return
    }

    // Prepare permissions data for API
    const permissionsData: Record<PermissionKey, {
      granted_type: string;
      granted_role?: string;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    }> = {}

    for (const permissionKey of tablePermissions) {
      const permissionValue = permissions.value[permissionKey]
      const selectedUserIds = selectedUsers.value[permissionKey]

      let grantedType = permissionValue
      let grantedRole: string | undefined
      let subjects: Array<{ type: 'user' | 'group'; id: string }> = []

      if (permissionValue === 'specific_users') {
        grantedType = 'specific_users'
        // Deduplicate user IDs before creating subjects
        const uniqueUserIds = [...new Set(selectedUserIds)]
        subjects = uniqueUserIds.map(userId => ({
          type: 'user' as const,
          id: userId
        }))
      }

      permissionsData[permissionKey] = {
        granted_type: grantedType,
        granted_role: grantedRole,
        subjects
      }
    }

    // Call the API to save permissions
    const { $api } = useNuxtApp()
    await $api.instance.post(`/api/v2/meta/bases/${currentBaseId}/tables/${props.tableId}/permissions`, {
      permissions: permissionsData
    })
    
    message.success('Table permissions updated successfully')
    visible.value = false
  } catch (e: any) {
    message.error('Failed to update table permissions')
    console.error(e)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralModal v-model:visible="visible" size="medium" centered>
    <div class="flex flex-col p-6">
      <div class="flex flex-row items-center pb-2 mb-6 font-medium text-lg text-nc-content-gray">
        <GeneralIcon icon="ncLock" class="mr-2" />
        {{ $t('title.editTablePermissions') }}
        <GeneralIcon icon="table" class="ml-2 mr-1" />
        <span v-if="title" class="font-normal">{{ title }}</span>
      </div>

      <div class="space-y-6">
        <div
          v-for="permissionKey in tablePermissions"
          :key="permissionKey"
          class="space-y-3"
        >
          <div class="flex items-center justify-between">
            <div class="font-medium text-gray-900">
              {{ PermissionMeta[permissionKey]?.label }}
            </div>
            
            <a-select
              v-model:value="permissions[permissionKey]"
              class="w-64 permission-select"
              @update:value="updatePermission(permissionKey, $event)"
            >
              <template #suffixIcon>
                <GeneralIcon icon="arrowDown" class="text-gray-400" />
              </template>
              
              <a-select-option
                v-for="option in PermissionOptions"
                :key="option.value"
                :value="option.value"
                class="py-2"
              >
                <div class="flex items-center space-x-2 w-full">
                  <div class="flex items-center justify-center w-4 h-4 flex-shrink-0">
                    <GeneralIcon 
                      :icon="option.icon" 
                      class="w-4 h-4"
                      :class="getPermissionOptionStyle(option.value).iconColor"
                    />
                  </div>
                  <span 
                    class="font-medium flex-1"
                    :class="getPermissionOptionStyle(option.value).textColor"
                  >
                    {{ option.label }}
                  </span>
                </div>
              </a-select-option>
            </a-select>
          </div>

          <!-- User selection interface for specific users -->
          <div v-if="permissions[permissionKey] === 'specific_users'" class="mt-4">
            <!-- Selected users display -->
            <div v-if="selectedUsers[permissionKey].length > 0" class="mb-3">
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="userId in selectedUsers[permissionKey]"
                  :key="userId"
                  class="flex items-center px-2 py-1 rounded-md text-sm border"
                  :class="[
                    getPermissionOptionStyle('specific_users').bgColor,
                    getPermissionOptionStyle('specific_users').borderColor,
                    getPermissionOptionStyle('specific_users').textColor
                  ]"
                >
                  <div 
                    class="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center mr-2"
                    :class="getUserAvatarColor(userId)"
                  >
                    {{ getUserInitials(baseUsers.find(u => u.id === userId)) }}
                  </div>
                  {{ getUserDisplayName(baseUsers.find(u => u.id === userId)) }}
                  <button
                    @click="toggleUserSelection(permissionKey, userId)"
                    class="ml-2 hover:opacity-75"
                    :class="getPermissionOptionStyle('specific_users').textColor"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <!-- User selection dropdown -->
            <div class="border border-gray-200 rounded-lg">
              <div class="p-3 border-b border-gray-200">
                <div class="relative">
                  <GeneralIcon icon="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    v-model="userSearchQuery"
                    type="text"
                    placeholder="Search user"
                    class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div class="max-h-48 overflow-y-auto">
                <div v-if="isLoadingUsers" class="p-4 text-center text-gray-500">
                  <GeneralIcon icon="loading" class="animate-spin w-4 h-4 mx-auto mb-2" />
                  Loading users...
                </div>
                <div v-else-if="filteredUsers.length === 0" class="p-4 text-center text-gray-500">
                  No users found
                </div>
                <div
                  v-for="user in filteredUsers"
                  :key="user.id"
                  class="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                  @click="toggleUserSelection(permissionKey, user.id)"
                >
                  <div class="flex items-center mr-3">
                    <input
                      type="checkbox"
                      :checked="selectedUsers[permissionKey].includes(user.id)"
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      @click.stop
                    />
                  </div>
                  
                  <div 
                    class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3"
                    :class="getUserAvatarColor(user.id)"
                  >
                    {{ getUserInitials(user) }}
                  </div>
                  
                  <div class="flex-1">
                    <div class="font-medium text-gray-900">{{ getUserDisplayName(user) }}</div>
                    <div class="text-sm text-gray-500">{{ user.email }}</div>
                  </div>
                
                </div>
              </div>
              
              <div class="p-3 border-t border-gray-200 flex justify-between">
                <button
                  @click="selectAllUsers(permissionKey)"
                  class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Select all
                </button>
                <button
                  @click="clearAllUsers(permissionKey)"
                  class="text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-row gap-x-2 mt-8 pt-4 border-t justify-end">
        <NcButton type="secondary" size="small" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          type="primary"
          size="small"
          :loading="isLoading"
          @click="onSave"
        >
          {{ $t('general.save') }}
          <template #loading>
            {{ $t('general.saving') }}
          </template>
        </NcButton>
      </div>
    </div>
  </GeneralModal>
</template>

<style scoped>
:deep(.permission-select .ant-select-selector) {
  display: flex !important;
  align-items: center !important;
  padding: 8px 12px !important;
}

:deep(.permission-select .ant-select-selection-item) {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

:deep(.permission-select .ant-select-selection-item .anticon) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
</style>
