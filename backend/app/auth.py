"""Demo auth: seeded users (one per role), bcrypt passwords, HS256 JWT.

Tenant identity comes ONLY from the token (rule 4). Plant scope comes from user_plants;
"*" means every plant of the tenant. Permissions follow the UI spec's module matrix and are
enforced in the backend (never only by hiding buttons).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app import models as m
from app.config import get_settings

ROLES = {  # role_id: (name, lands_on)
    "leadership": ("Leadership / Plant head", "/overview"),
    "inventory_manager": ("Inventory manager", "/overview"),
    "planner": ("Production planner", "/shortages"),
    "buyer": ("Purchasing Officer", "/proposals"),
    "procurement_manager": ("Procurement manager", "/proposals"),
    "stores": ("Stores / warehouse", "/uploads"),
    "data_admin": ("Data admin", "/uploads"),
    "sys_admin": ("System admin", "/uploads"),
}

# Module permissions from the UI spec (V view, A act, L1 / L2 approve). Missing = hidden.
PERMS: dict[str, dict[str, set[str]]] = {
    "home": {r: {"V"} for r in ROLES},
    "inventory": {r: {"V"} for r in ROLES} | {"inventory_manager": {"V", "A"}, "stores": {"V", "A"}},
    "planning": {r: {"V"} for r in ROLES} | {"inventory_manager": {"V", "A"}, "planner": {"V", "A"}},
    "replenishment": {r: {"V"} for r in ROLES} | {
        "inventory_manager": {"V", "A"},
        "planner": {"V", "A"},
        "buyer": {"V", "A", "L1"},
        "procurement_manager": {"V", "A", "L2"},
        "leadership": {"V", "A", "L1", "L2"},
    },
    "insights": {r: {"V"} for r in ROLES},
    "data": {r: {"V"} for r in ROLES} | {"stores": {"V", "A"}, "data_admin": {"V", "A"}, "sys_admin": {"V", "A"}},
}

DEMO_PASSWORD = "demo"
# username, display name, role, plants ("*" = all tenant plants)
DEMO_USERS = [
    ("leader", "Leela Iyer", "leadership", "*"),
    ("invmgr", "Imran Khan", "inventory_manager", "*"),
    ("planner", "Priya Nair", "planner", "*"),
    ("buyer", "Bala Raman", "buyer", "*"),
    ("procmgr", "Meera Pillai", "procurement_manager", "*"),
    ("stores", "Sanjay Rao", "stores", "*"),
    ("dataadmin", "Divya Menon", "data_admin", "*"),
    ("sysadmin", "Arun Das", "sys_admin", "*"),
    ("buyer.ka", "Kiran Gowda", "buyer", "IN-KA-01"),  # plant-scoped buyer (Bengaluru only)
]


@dataclass
class Principal:
    user_id: int
    username: str
    display_name: str
    tenant_id: str
    role: str
    plants: list[str] = field(default_factory=list)

    def can(self, module: str, perm: str) -> bool:
        return perm in PERMS.get(module, {}).get(self.role, set())

    def require(self, module: str, perm: str) -> None:
        if not self.can(module, perm):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Role '{self.role}' may not {perm} in {module}")

    def require_plant(self, plant_id: str | None) -> None:
        if plant_id and plant_id not in self.plants:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"No access to plant {plant_id}")

    def scope(self, plant: str | None) -> list[str]:
        """Plants a query may touch: the requested one (checked) or all the user's plants."""
        if plant:
            self.require_plant(plant)
            return [plant]
        return list(self.plants)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=8)).decode()


def seed_roles_and_users(s: Session, tenant_id: str, users=DEMO_USERS, suffix: str = "") -> None:
    s.execute(pg_insert(m.Role).values([{"role_id": k, "name": v[0], "lands_on": v[1]} for k, v in ROLES.items()])
              .on_conflict_do_nothing())
    pw = hash_password(DEMO_PASSWORD)
    for username, name, role, plants in users:
        uname = username + suffix
        uid = s.scalar(select(m.User.id).where(m.User.username == uname))
        if uid is None:
            uid = s.scalar(pg_insert(m.User).values(tenant_id=tenant_id, username=uname, display_name=name,
                                                    password_hash=pw, role_id=role, active=True)
                           .returning(m.User.id))
            s.execute(pg_insert(m.UserPlant).values(user_id=uid, plant_id=plants).on_conflict_do_nothing())


def authenticate(s: Session, username: str, password: str) -> m.User | None:
    u = s.scalar(select(m.User).where(m.User.username == username, m.User.active.is_(True)))
    if u and bcrypt.checkpw(password.encode(), u.password_hash.encode()):
        return u
    return None


def principal_for(s: Session, user: m.User) -> Principal:
    plants = list(s.scalars(select(m.UserPlant.plant_id).where(m.UserPlant.user_id == user.id)))
    if "*" in plants:
        plants = list(s.scalars(select(m.Plant.plant_id).where(m.Plant.tenant_id == user.tenant_id)
                                .order_by(m.Plant.plant_id)))
    return Principal(user.id, user.username, user.display_name, user.tenant_id, user.role_id, plants)


def issue_token(p: Principal) -> str:
    st = get_settings()
    now = datetime.now(timezone.utc)
    claims = {"sub": p.username, "uid": p.user_id, "name": p.display_name, "tenant": p.tenant_id,
              "role": p.role, "plants": p.plants, "iat": now, "exp": now + timedelta(hours=st.jwt_ttl_hours)}
    return jwt.encode(claims, st.jwt_secret, algorithm="HS256")


_bearer = HTTPBearer(auto_error=False)


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Principal:
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    try:
        c = jwt.decode(cred.credentials, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    return Principal(c["uid"], c["sub"], c["name"], c["tenant"], c["role"], list(c["plants"]))
