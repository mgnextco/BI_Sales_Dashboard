# Firebase Security Specification and Target Payloads

This specification defines the formal attribute-based access control (ABAC) rules for our BI Sales Dashboard.

## Data Invariants
1. **User Ownership**: Only the legitimate user who authenticated with Firebase Auth may access or construct documents referencing their `ownerUid`.
2. **Admin Privilege Level**: Users whose user document has `role == 'Administrator'` or whose email is `michel.gamal.honor@gmail.com` can read and write all documents across collections.
3. **Role Lock**: No non-administrator user can change their own authorization role field.
4. **Data Integrity**: Document IDs must be alphanumeric strings to prevent resource exploitation or path attacks.

## The Dirty Dozen Payloads (Vulnerability Attempts)

### User Profiling Attacks
1. **Unauthenticated Profile Read**: Reading `/users/someUserId` without a valid Firebase session. Expected: `PERMISSION_DENIED`.
2. **Cross-User Profile Read**: Normal user `user_A` trying to read `/users/user_B`. Expected: `PERMISSION_DENIED`.
3. **Self-Elevated Registration**: Registering a profile with `uid: "user_C"` and assigning `"role": "Administrator"` when the user is not `michel.gamal.honor@gmail.com`. Expected: `PERMISSION_DENIED`.
4. **Identity Spoofing Profile Update**: Editing `/users/user_A` to switch `uid` or `email` fields. Expected: `PERMISSION_DENIED`.

### Version Injection & Leakage Attacks
5. **Cross-User Version Extraction**: Normal user `user_A` trying to read `/versions/version_of_user_B` directly. Expected: `PERMISSION_DENIED`.
6. **Malicious Version Listing**: A simple user calling `getDocs(collection("versions"))` to scrap the entire dataset repository. Expected: `PERMISSION_DENIED` unless filtered by owner or requested by Administrator.
7. **Phantom Document ID Creation**: Trying to write a saved version using an oversized or invalid document ID (e.g. `/versions/%%%%--poised-exploit--%%%%`). Expected: `PERMISSION_DENIED` due to standard validation.
8. **Malicious Payload Size Blowout**: Creating a version document where `name` is a 2MB string. Expected: `PERMISSION_DENIED` due to size check.
9. **Creation Ownership Mismatch**: Creating a version with `ownerUid: "victim_user"` while authenticated as `attacker_user`. Expected: `PERMISSION_DENIED`.
10. **State Corruption / Immutable Alteration**: Updating a version's `ownerUid` or `id` fields after creation. Expected: `PERMISSION_DENIED`.
11. **Admin Role Spoofing**: Trying to update a user's role from "Viewer" to "Administrator" under the user's login. Expected: `PERMISSION_DENIED`.
12. **PII Blanket Harvest**: Unrestricted queries to fetch user lists. Expected: `PERMISSION_DENIED`.
