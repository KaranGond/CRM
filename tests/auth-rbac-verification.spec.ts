/**
 * Authentication, Authorization (RBAC), and User Management Verification Suite
 *
 * Verifies self-sustaining authentication and authorization capabilities:
 * 1. Multi-role authentication (Admin, Manager, Telecaller)
 * 2. Token refresh rotation & replay attack protection
 * 3. Self-service password change
 * 4. Role-based access control (RBAC) enforcement on Users API
 * 5. Admin user management (Create, Update, Reset Password, List with search/filter)
 * 6. Account activation/deactivation kill-switch (Immediate JWT invalidation)
 * 7. Self-protection (Cannot deactivate or delete own account)
 */

import { strict as assert } from "node:assert";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000/api";

async function runAuthRbacVerification() {
  console.log("==================================================================");
  console.log("🔐 STARTING AUTHENTICATION, RBAC & USER MANAGEMENT VERIFICATION");
  console.log("==================================================================");

  // --------------------------------------------------------------------------
  // Step 1: Authenticate Admin, Manager, and Telecaller
  // --------------------------------------------------------------------------
  console.log("\n▶ [1/8] Authenticating Admin, Manager, and Telecaller...");

  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@telecalling.crm",
      password: "Password123!",
      deviceId: "test-admin-web",
    }),
  });
  assert.equal(adminLoginRes.status, 201 || 200, "Admin login must succeed");
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.data.accessToken;
  const adminUser = adminData.data.user;
  assert.equal(adminUser.role, "admin", "Admin role must be 'admin'");
  console.log(`  ✓ Super Admin logged in: ${adminUser.email} (Role: ${adminUser.role})`);

  const managerLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "manager@telecalling.crm",
      password: "Password123!",
      deviceId: "test-manager-web",
    }),
  });
  assert.equal(managerLoginRes.status, 201 || 200, "Manager login must succeed");
  const managerData = await managerLoginRes.json();
  const managerToken = managerData.data.accessToken;
  const managerUser = managerData.data.user;
  assert.equal(managerUser.role, "manager", "Manager role must be 'manager'");
  console.log(`  ✓ Operations Manager logged in: ${managerUser.email} (Role: ${managerUser.role})`);

  const callerLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "caller1@telecalling.crm",
      password: "Password123!",
      deviceId: "test-caller-device",
    }),
  });
  assert.equal(callerLoginRes.status, 201 || 200, "Telecaller login must succeed");
  const callerData = await callerLoginRes.json();
  const callerToken = callerData.data.accessToken;
  let callerRefreshToken = callerData.data.refreshToken;
  const callerUser = callerData.data.user;
  assert.equal(callerUser.role, "telecaller", "Telecaller role must be 'telecaller'");
  console.log(`  ✓ Telecaller logged in: ${callerUser.email} (Role: ${callerUser.role})`);

  // --------------------------------------------------------------------------
  // Step 2: Test Refresh Token Rotation & Replay Attack Protection
  // --------------------------------------------------------------------------
  console.log("\n▶ [2/8] Testing Refresh Token Rotation & Replay Protection...");
  const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: callerRefreshToken,
      deviceId: "test-caller-device",
    }),
  });
  assert.equal(refreshRes.status, 201 || 200, "Token refresh must succeed");
  const refreshData = await refreshRes.json();
  assert.ok(refreshData.data.accessToken, "Must return new accessToken");
  assert.ok(refreshData.data.refreshToken, "Must return rotated refreshToken");
  const oldRefreshToken = callerRefreshToken;
  callerRefreshToken = refreshData.data.refreshToken;
  console.log("  ✓ Token refresh rotated cleanly with new JWT pair");

  // Replay Attack Test: Attempt to reuse the old refresh token
  const replayRes = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: oldRefreshToken,
      deviceId: "test-caller-device",
    }),
  });
  assert.equal(replayRes.status, 401, "Replay of rotated refresh token MUST be rejected with 401");
  console.log("  ✓ Replay attack detected and rejected (401 Unauthorized)");

  // --------------------------------------------------------------------------
  // Step 3: Self-Service Password Change
  // --------------------------------------------------------------------------
  console.log("\n▶ [3/8] Testing Self-Service Password Change...");
  // Attempt with wrong current password
  const badPassRes = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${callerToken}`,
    },
    body: JSON.stringify({
      currentPassword: "WrongPassword999!",
      newPassword: "NewSecretPassword123!",
    }),
  });
  assert.equal(badPassRes.status, 400, "Wrong current password must return 400");
  console.log("  ✓ Bad current password rejected with 400 Bad Request");

  // Change with correct current password
  const goodPassRes = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${callerToken}`,
    },
    body: JSON.stringify({
      currentPassword: "Password123!",
      newPassword: "NewSecretPassword123!",
    }),
  });
  assert.equal(goodPassRes.status, 201 || 200, "Password change must succeed");
  console.log("  ✓ Password changed successfully for telecaller");

  // Verify login with new password
  const newLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "caller1@telecalling.crm",
      password: "NewSecretPassword123!",
    }),
  });
  assert.equal(newLoginRes.status, 201 || 200, "Login with new password must succeed");
  const newLoginData = await newLoginRes.json();
  const freshCallerToken = newLoginData.data.accessToken;

  // Restore original password for test repeatability
  const restoreRes = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${freshCallerToken}`,
    },
    body: JSON.stringify({
      currentPassword: "NewSecretPassword123!",
      newPassword: "Password123!",
    }),
  });
  assert.equal(restoreRes.status, 201 || 200, "Password restored to Password123!");
  console.log("  ✓ Telecaller password restored to original");

  // --------------------------------------------------------------------------
  // Step 4: Role-Based Access Control on GET /users
  // --------------------------------------------------------------------------
  console.log("\n▶ [4/8] Testing RBAC on User Listings (GET /users)...");

  // Telecaller should be FORBIDDEN
  const telecallerListRes = await fetch(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${callerToken}` },
  });
  assert.equal(telecallerListRes.status, 403, "Telecaller MUST be forbidden from listing users (403)");
  console.log("  ✓ Telecaller blocked from user listing with 403 Forbidden");

  // Manager should SUCCEED
  const managerListRes = await fetch(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  assert.equal(managerListRes.status, 200, "Manager must be allowed to list users (200)");
  const managerListData = await managerListRes.json();
  assert.ok(Array.isArray(managerListData.data), "Must return array of users");
  console.log(`  ✓ Manager successfully listed ${managerListData.data.length} users`);

  // Admin should SUCCEED with search and filter
  const adminListFilterRes = await fetch(`${API_BASE}/users?role=telecaller`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminListFilterRes.status, 200, "Admin filtered user listing must succeed");
  const filterData = await adminListFilterRes.json();
  const allTelecallers = filterData.data.every((u: any) => u.role === "telecaller");
  assert.ok(allTelecallers, "All returned users must have role 'telecaller'");
  console.log(`  ✓ Admin filtered users by role=telecaller: ${filterData.data.length} telecallers returned`);

  // --------------------------------------------------------------------------
  // Step 5: User Creation (Admin Only)
  // --------------------------------------------------------------------------
  console.log("\n▶ [5/8] Testing User Creation & RBAC Enforcement (POST /users)...");

  const runId = Date.now();
  const testUserEmail = `audit.user.${runId}@telecalling.crm`;

  // Telecaller tries to create user -> 403
  const telecallerCreateRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${callerToken}`,
    },
    body: JSON.stringify({
      name: "Rogue User",
      email: testUserEmail,
      phone: "+919988776655",
      password: "Password123!",
      role: "telecaller",
    }),
  });
  assert.equal(telecallerCreateRes.status, 403, "Telecaller cannot create users (403 Forbidden)");
  console.log("  ✓ Telecaller prevented from creating user (403 Forbidden)");

  // Manager tries to create user -> 403
  const managerCreateRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({
      name: "Rogue User",
      email: testUserEmail,
      phone: "+919988776655",
      password: "Password123!",
      role: "telecaller",
    }),
  });
  assert.equal(managerCreateRes.status, 403, "Manager cannot create users (403 Forbidden)");
  console.log("  ✓ Manager prevented from creating user (403 Forbidden)");

  // Admin creates user -> 201/200
  const adminCreateRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Audit Test Agent",
      email: testUserEmail,
      phone: "+919988776655",
      password: "Password123!",
      role: "telecaller",
    }),
  });
  assert.equal(adminCreateRes.status, 201 || 200, "Admin user creation must succeed");
  const createResult = await adminCreateRes.json();
  const createdUserId = createResult.data.id;
  assert.ok(createdUserId, "Created user must have an id");
  console.log(`  ✓ Super Admin created user: ${testUserEmail} (ID: ${createdUserId})`);

  // Duplicate email check
  const duplicateRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Duplicate User",
      email: testUserEmail,
      phone: "+919988776655",
      password: "Password123!",
      role: "telecaller",
    }),
  });
  assert.equal(duplicateRes.status, 400, "Duplicate email must return 400 Bad Request");
  console.log("  ✓ Duplicate email creation rejected with 400 Bad Request");

  // --------------------------------------------------------------------------
  // Step 6: User Update & Admin Password Reset
  // --------------------------------------------------------------------------
  console.log("\n▶ [6/8] Testing User Update & Admin Password Reset...");

  // Update name and phone
  const updateRes = await fetch(`${API_BASE}/users/${createdUserId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Audit Test Agent (Updated)",
      phone: "+919988776699",
    }),
  });
  assert.equal(updateRes.status, 200, "Admin user update must succeed");
  const updateData = await updateRes.json();
  assert.equal(updateData.data.name, "Audit Test Agent (Updated)");
  console.log("  ✓ Admin updated user profile successfully");

  // Admin resets password for user
  const resetPassRes = await fetch(`${API_BASE}/users/${createdUserId}/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      newPassword: "AdminAssignedPass99!",
    }),
  });
  assert.equal(resetPassRes.status, 200, "Admin password reset must succeed");
  console.log("  ✓ Admin reset password successfully");

  // Verify user can log in with admin-assigned password
  const testUserLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testUserEmail,
      password: "AdminAssignedPass99!",
    }),
  });
  assert.equal(testUserLoginRes.status, 201 || 200, "Test user login must succeed with new password");
  const testUserLoginData = await testUserLoginRes.json();
  const testUserToken = testUserLoginData.data.accessToken;
  console.log("  ✓ Created user logged in successfully with admin-reset password");

  // --------------------------------------------------------------------------
  // Step 7: Deactivation Kill-Switch & Immediate JWT Invalidation
  // --------------------------------------------------------------------------
  console.log("\n▶ [7/8] Testing Deactivation Kill-Switch & Immediate Invalidation...");

  // Verify test user token works initially
  const profileBeforeDeact = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${testUserToken}` },
  });
  assert.equal(profileBeforeDeact.status, 200, "User profile works when active");

  // Admin deactivates test user
  const deactRes = await fetch(`${API_BASE}/users/${createdUserId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactRes.status, 200, "User status toggle to false must succeed");
  console.log("  ✓ Admin toggled user status: active = false");

  // The previously issued JWT MUST fail validation immediately (401)
  const profileAfterDeact = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${testUserToken}` },
  });
  assert.equal(profileAfterDeact.status, 401, "Deactivated user JWT MUST be rejected immediately with 401");
  console.log("  ✓ Live JWT immediately invalidated: 401 Unauthorized");

  // Login attempt by deactivated user must fail
  const deactLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testUserEmail,
      password: "AdminAssignedPass99!",
    }),
  });
  assert.equal(deactLoginRes.status, 401, "Deactivated user login attempt MUST be rejected with 401");
  console.log("  ✓ Deactivated user login rejected: 401 Unauthorized");

  // Reactivate user
  const reactivateRes = await fetch(`${API_BASE}/users/${createdUserId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ active: true }),
  });
  assert.equal(reactivateRes.status, 200, "Reactivation must succeed");
  console.log("  ✓ Admin reactivated user: active = true");

  // Login works again
  const reactivateLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testUserEmail,
      password: "AdminAssignedPass99!",
    }),
  });
  assert.equal(reactivateLoginRes.status, 201 || 200, "Reactivated user login succeeds");
  console.log("  ✓ Reactivated user logged in successfully");

  // --------------------------------------------------------------------------
  // Step 8: Self-Protection & Deletion
  // --------------------------------------------------------------------------
  console.log("\n▶ [8/8] Testing Self-Protection & Soft-Delete...");

  // Admin cannot deactivate self
  const selfDeactRes = await fetch(`${API_BASE}/users/${adminUser.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(selfDeactRes.status, 400, "Admin self-deactivation MUST be blocked with 400");
  console.log("  ✓ Admin self-deactivation blocked (400 Bad Request)");

  // Admin cannot delete self
  const selfDeleteRes = await fetch(`${API_BASE}/users/${adminUser.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(selfDeleteRes.status, 400, "Admin self-deletion MUST be blocked with 400");
  console.log("  ✓ Admin self-deletion blocked (400 Bad Request)");

  // Admin deletes (soft-deactivates) test user
  const deleteTestUserRes = await fetch(`${API_BASE}/users/${createdUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteTestUserRes.status, 200, "Soft deletion of test user must succeed");
  console.log(`  ✓ Test user ${testUserEmail} deactivated permanently`);

  console.log("\n==================================================================");
  console.log("🎉 ALL 8/8 AUTHENTICATION, RBAC & USER MANAGEMENT TESTS PASSED!");
  console.log("==================================================================");
}

runAuthRbacVerification().catch((err) => {
  console.error("\n❌ AUTH & RBAC VERIFICATION FAILED:", err);
  process.exit(1);
});
