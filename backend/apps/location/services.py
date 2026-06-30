from __future__ import annotations

from collections import defaultdict

from django.utils import timezone

from .models import StorageNode


def build_children_map(nodes) -> dict[int | None, list[StorageNode]]:
    children_by_parent: dict[int | None, list[StorageNode]] = defaultdict(list)
    for node in nodes:
        children_by_parent[node.parent_id].append(node)
    return children_by_parent


def get_descendant_ids_from_nodes(node_id: int, nodes) -> list[int]:
    children_by_parent = build_children_map(nodes)
    ids: list[int] = []
    stack = [node_id]
    while stack:
        current_id = stack.pop()
        ids.append(current_id)
        stack.extend(child.id for child in children_by_parent.get(current_id, []))
    return ids


def get_descendant_ids(node: StorageNode, queryset=None) -> list[int]:
    qs = queryset if queryset is not None else StorageNode.objects.filter(user=node.user)
    return get_descendant_ids_from_nodes(node.id, list(qs))


def make_path_name(name: str, parent: StorageNode | None) -> str:
    if parent is None:
        return name
    parent_path = parent.path_name or parent.name
    return f"{parent_path}/{name}"


def refresh_descendant_paths(root: StorageNode) -> None:
    nodes = list(StorageNode.objects.filter(user=root.user).select_related("parent").order_by("id"))
    nodes_by_id = {node.id: node for node in nodes}
    by_parent = build_children_map(nodes)

    now = timezone.now()
    updates: list[StorageNode] = []
    stack = list(by_parent.get(root.id, []))
    while stack:
        node = stack.pop()
        parent = nodes_by_id.get(node.parent_id) if node.parent_id else None
        next_path = make_path_name(node.name, parent)
        if node.path_name != next_path:
            node.path_name = next_path
            node.updated_at = now
            updates.append(node)
        stack.extend(by_parent.get(node.id, []))

    if updates:
        StorageNode.objects.bulk_update(updates, ["path_name", "updated_at"])
