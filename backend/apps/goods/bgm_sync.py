"""
BGM 增量同步：核心 diff 算法与 apply 执行。

设计目标：
- 精确匹配：优先用 bgm_character_id 一致匹配本地角色；
- 名字回填：若本地存在同名但 bgm_character_id 为空，标记为 link_by_name；
- 新增：BGM 上存在但本地完全没有的角色；
- 本地独有：本地存在但 BGM 上没有的角色 —— 仅展示，不做任何处理（可能关联了商品）;
- 重复保护：BGM 偶发返回同名多条角色时，仅保留第一条，其余标记为 skipped_duplicate。

可独立单测，不依赖 HTTP / DRF。
"""
from __future__ import annotations

from typing import Iterable, Optional

from django.db import transaction
from django.utils import timezone

from .models import Character, IP


def compute_bgm_diff(ip: IP, bgm_characters: Iterable[dict]) -> dict:
    """
    计算本地 IP 与 BGM 角色列表的差异。

    Args:
        ip: 本地 IP 实例（需已 select 相关字段）。
        bgm_characters: BGM 返回的角色列表，每项形如
            {"id": int|None, "name": str, "relation": str, "avatar": str}

    Returns:
        dict: 含 items / summary 字段。items 中 action ∈ {new, link_by_name,
              matched, local_only, skipped_duplicate}。
    """
    # 本地角色快照
    local_chars = list(ip.characters.all())
    local_by_bgm_id: dict[int, Character] = {
        c.bgm_character_id: c for c in local_chars if c.bgm_character_id
    }
    local_by_name: dict[str, Character] = {c.name: c for c in local_chars}

    items: list[dict] = []
    matched_local_ids: set[int] = set()
    seen_bgm_ids: set[int] = set()
    seen_names: set[str] = set()

    for entry in bgm_characters:
        bgm_id = entry.get("id")
        name = (entry.get("name") or "").strip()
        if not name:
            # BGM 数据脏，跳过空 name
            continue
        relation = entry.get("relation") or ""
        avatar = entry.get("avatar") or ""

        # 重复保护：BGM 同 IP 下罕见地返回同 ID 或同 name 多次
        dup_key = (bgm_id, name)
        if bgm_id and bgm_id in seen_bgm_ids:
            items.append({
                "action": "skipped_duplicate",
                "bgm_character_id": bgm_id,
                "name": name,
                "relation": relation,
                "avatar": avatar,
                "local_character_id": None,
            })
            continue
        if name in seen_names and not bgm_id:
            items.append({
                "action": "skipped_duplicate",
                "bgm_character_id": bgm_id,
                "name": name,
                "relation": relation,
                "avatar": avatar,
                "local_character_id": None,
            })
            continue
        if bgm_id:
            seen_bgm_ids.add(bgm_id)
        seen_names.add(name)
        _ = dup_key  # 仅为可读

        # 1) 精确匹配 bgm_character_id
        if bgm_id and bgm_id in local_by_bgm_id:
            local = local_by_bgm_id[bgm_id]
            matched_local_ids.add(local.id)
            items.append({
                "action": "matched",
                "bgm_character_id": bgm_id,
                "name": name,
                "relation": relation,
                "avatar": avatar,
                "local_character_id": local.id,
            })
            continue

        # 2) name 回退匹配（本地未绑定 bgm_character_id）
        local = local_by_name.get(name)
        if local is not None:
            # 已被其它 BGM ID 匹配过则跳过（不可能：matched 分支已处理同 bgm_id）
            if local.bgm_character_id and local.bgm_character_id != bgm_id:
                # 本地这个名字的角色已绑定别的 BGM ID，视为新增更安全；
                # 不计入 matched_local_ids，让该本地角色在末尾归入 local_only。
                items.append({
                    "action": "new",
                    "bgm_character_id": bgm_id,
                    "name": name,
                    "relation": relation,
                    "avatar": avatar,
                    "local_character_id": None,
                })
                continue
            matched_local_ids.add(local.id)
            items.append({
                "action": "link_by_name",
                "bgm_character_id": bgm_id,
                "name": name,
                "relation": relation,
                "avatar": avatar,
                "local_character_id": local.id,
            })
            continue

        # 3) 新增
        items.append({
            "action": "new",
            "bgm_character_id": bgm_id,
            "name": name,
            "relation": relation,
            "avatar": avatar,
            "local_character_id": None,
        })

    # 4) 本地独有：BGM 没出现的本地角色
    for local in local_chars:
        if local.id in matched_local_ids:
            continue
        items.append({
            "action": "local_only",
            "bgm_character_id": local.bgm_character_id,
            "name": local.name,
            "relation": "",
            "avatar": local.avatar or "",
            "local_character_id": local.id,
        })

    summary = {
        "new": 0,
        "link_by_name": 0,
        "matched": 0,
        "local_only": 0,
        "skipped_duplicate": 0,
    }
    for it in items:
        summary[it["action"]] = summary.get(it["action"], 0) + 1

    return {"items": items, "summary": summary}


@transaction.atomic
def apply_bgm_sync(
    ip: IP,
    bgm_subject_id: int,
    items: list[dict],
    bgm_subject_type: Optional[int] = None,
    update_subject_type: bool = True,
) -> dict:
    """
    将用户确认的 diff 项应用到数据库。

    - 新增 / 按名字回填 在同事务内幂等执行；
    - 若 IP 尚未绑定 bgm_subject_id，则此次写入持久化；
    - 同时根据策略可选地更新 subject_type；
    - 不修改 local_only / matched 角色；
    - 不覆盖已有 avatar（保持与现有 bgm_create_characters 一致的保守策略）。
    """
    subject_linked = False
    if ip.bgm_subject_id is None:
        ip.bgm_subject_id = bgm_subject_id
        subject_linked = True

    subject_type_updated = False
    if (
        update_subject_type
        and bgm_subject_type is not None
        and ip.subject_type != bgm_subject_type
    ):
        ip.subject_type = bgm_subject_type
        subject_type_updated = True

    created_count = 0
    linked_count = 0
    details: list[dict] = []

    for entry in items:
        action = entry.get("action")
        name = (entry.get("name") or "").strip()
        if not name:
            continue
        bgm_character_id = entry.get("bgm_character_id")
        avatar = entry.get("avatar") or None
        local_id = entry.get("local_character_id")

        try:
            if action == "new":
                # 使用 unique_together (ip, name) 防止竞态重复
                obj, created = Character.objects.get_or_create(
                    ip=ip,
                    name=name,
                    defaults={
                        "avatar": avatar,
                        "bgm_character_id": bgm_character_id,
                    },
                )
                if created:
                    created_count += 1
                    details.append({
                        "action": "new",
                        "name": name,
                        "character_id": obj.id,
                        "status": "created",
                    })
                else:
                    # 罕见：在 preview 之后被并发新建。若它没有 BGM ID，则改作 link。
                    changed_fields = []
                    if not obj.bgm_character_id and bgm_character_id:
                        obj.bgm_character_id = bgm_character_id
                        changed_fields.append("bgm_character_id")
                    if not obj.avatar and avatar:
                        obj.avatar = avatar
                        changed_fields.append("avatar")
                    if changed_fields:
                        obj.save(update_fields=changed_fields)
                        linked_count += 1
                        details.append({
                            "action": "new",
                            "name": name,
                            "character_id": obj.id,
                            "status": "linked_existing",
                        })
                    else:
                        details.append({
                            "action": "new",
                            "name": name,
                            "character_id": obj.id,
                            "status": "already_exists",
                        })
            elif action == "link_by_name":
                if not local_id:
                    details.append({
                        "action": "link_by_name",
                        "name": name,
                        "status": "skipped_missing_local",
                    })
                    continue
                try:
                    obj = Character.objects.get(ip=ip, id=local_id)
                except Character.DoesNotExist:
                    details.append({
                        "action": "link_by_name",
                        "name": name,
                        "status": "skipped_missing_local",
                    })
                    continue
                changed_fields: list[str] = []
                if bgm_character_id and obj.bgm_character_id != bgm_character_id:
                    obj.bgm_character_id = bgm_character_id
                    changed_fields.append("bgm_character_id")
                if not obj.avatar and avatar:
                    obj.avatar = avatar
                    changed_fields.append("avatar")
                if changed_fields:
                    obj.save(update_fields=changed_fields)
                    linked_count += 1
                    details.append({
                        "action": "link_by_name",
                        "name": name,
                        "character_id": obj.id,
                        "status": "linked",
                    })
                else:
                    details.append({
                        "action": "link_by_name",
                        "name": name,
                        "character_id": obj.id,
                        "status": "already_linked",
                    })
            else:
                details.append({
                    "action": action,
                    "name": name,
                    "status": "ignored",
                })
        except Exception as e:  # pragma: no cover - 仅作兜底
            details.append({
                "action": action,
                "name": name,
                "status": "error",
                "error": str(e),
            })

    # 持久化 IP 字段更新（包括 last_synced_at）
    ip.last_synced_at = timezone.now()
    update_fields = ["last_synced_at"]
    if subject_linked:
        update_fields.append("bgm_subject_id")
    if subject_type_updated:
        update_fields.append("subject_type")
    ip.save(update_fields=update_fields)

    return {
        "ip_id": ip.id,
        "bgm_subject_id": ip.bgm_subject_id,
        "created_count": created_count,
        "linked_count": linked_count,
        "subject_linked": subject_linked,
        "subject_type_updated": subject_type_updated,
        "last_synced_at": ip.last_synced_at,
        "details": details,
    }
