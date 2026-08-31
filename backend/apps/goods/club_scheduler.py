"""One-shot publication scheduler for club catalog items."""
from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from .models import ClubCatalogItem

logger = logging.getLogger(__name__)


def publish_scheduled_club_goods() -> int:
    """Publish due draft items once, returning the number of successful items.

    Each item is locked independently so multiple web workers cannot publish the
    same catalog item. Items that cannot be published remain drafts and retain a
    visible failure record; the active schedule is cleared to avoid silent retries.
    """
    now = timezone.now()
    due_ids = list(
        ClubCatalogItem.objects.filter(
            publication_status=ClubCatalogItem.PUBLICATION_DRAFT,
            publish_at__isnull=False,
            publish_at__lte=now,
        ).values_list("id", flat=True)
    )
    published = 0
    for item_id in due_ids:
        try:
            with transaction.atomic():
                item = (
                    ClubCatalogItem.objects.select_for_update()
                    .prefetch_related("characters")
                    .filter(pk=item_id)
                    .first()
                )
                if item is None or item.publication_status != ClubCatalogItem.PUBLICATION_DRAFT:
                    continue
                if item.publish_at is None or item.publish_at > timezone.now():
                    continue
                if not item.characters.exists():
                    item.publish_at = None
                    item.publish_failed_at = timezone.now()
                    item.publish_error = "上架时至少需要选择一个角色"
                    item.save(update_fields=["publish_at", "publish_failed_at", "publish_error", "updated_at"])
                    continue
                item.publication_status = ClubCatalogItem.PUBLICATION_LISTED
                item.publish_at = None
                item.publish_failed_at = None
                item.publish_error = None
                item.save(
                    update_fields=[
                        "publication_status", "publish_at", "publish_failed_at", "publish_error", "updated_at"
                    ]
                )
                published += 1
        except Exception as exc:  # noqa: BLE001 - one broken item must not block the queue
            logger.exception("scheduled club publication failed for item %s", item_id)
            with transaction.atomic():
                item = ClubCatalogItem.objects.select_for_update().filter(pk=item_id).first()
                if item is not None and item.publication_status == ClubCatalogItem.PUBLICATION_DRAFT:
                    item.publish_at = None
                    item.publish_failed_at = timezone.now()
                    item.publish_error = str(exc)[:2000] or "定时上架失败"
                    item.save(update_fields=["publish_at", "publish_failed_at", "publish_error", "updated_at"])
    if due_ids and published:
        logger.info("published %d scheduled club catalog items", published)
    return published
