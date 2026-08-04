/**
 * DeepMindQ Enterprise Test Fixtures — Users
 * Milestone 3: 6 test users covering all roles + edge cases
 */

export const testUsers = [
  {
    "id": "user-admin-001",
    "email": "admin@deepmindq.com",
    "name": "Primary Admin",
    "role": "admin",
    "isActive": true,
    "hasPassword": true,
    "avatarUrl": null
  },
  {
    "id": "user-operator-001",
    "email": "operator@deepmindq.com",
    "name": "Operations Lead",
    "role": "operator",
    "isActive": true,
    "hasPassword": true,
    "avatarUrl": null
  },
  {
    "id": "user-user-001",
    "email": "user@deepmindq.com",
    "name": "Standard User",
    "role": "user",
    "isActive": true,
    "hasPassword": true,
    "avatarUrl": null
  },
  {
    "id": "user-viewer-001",
    "email": "viewer@deepmindq.com",
    "name": "Report Viewer",
    "role": "viewer",
    "isActive": true,
    "hasPassword": true,
    "avatarUrl": null
  },
  {
    "id": "user-inactive-001",
    "email": "inactive@deepmindq.com",
    "name": "Deactivated User",
    "role": "user",
    "isActive": false,
    "hasPassword": true,
    "avatarUrl": null
  },
  {
    "id": "user-nopass-001",
    "email": "newuser@deepmindq.com",
    "name": "New OTP User",
    "role": "user",
    "isActive": true,
    "hasPassword": false,
    "avatarUrl": null
  }
] as const;

export const testUsersByRole = (role: string) =>
  testUsers.filter(u => u.role === role);

export const testActiveUsers = () =>
  testUsers.filter(u => u.isActive);

export const testInactiveUsers = () =>
  testUsers.filter(u => !u.isActive);

export const testUsersWithoutPassword = () =>
  testUsers.filter(u => !u.hasPassword);

export default testUsers;
