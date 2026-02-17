## Phase 0 Privileged User Inventory

Generated on: 2026-02-17

Source query:

```sql
SELECT id, email, role, "organizationId", "isActive"
FROM "users"
WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER');
```

Results:

| id | email | role | organizationId | isActive |
| --- | --- | --- | --- | --- |
| user_super_admin | superadmin@bloom.com | SUPER_ADMIN | null | true |
| user_org1_admin | admin1@org1.com | ADMIN | org_test_1 | true |
| user_org1_manager | manager1@org1.com | MANAGER | org_test_1 | true |
| user_org2_admin | admin2@org2.com | ADMIN | org_test_2 | true |
| user_org2_manager | manager2@org2.com | MANAGER | org_test_2 | true |
| user_d9671911-1 | sirpawle@gmail.com | ADMIN | org_18b462bb | false |

