import logging

from django.db import transaction
from django.db.models.signals import m2m_changed, post_save, pre_save
from django.utils import timezone
from django.dispatch import receiver

from apps.goods.models import Goods, Showcase, ShowcaseGoods
from apps.reminder.models import Preorder
from apps.users.models import User

from .models import Achievement, AchievementSet

ELIGIBLE_GOODS_STATUSES = {"in_cabinet", "outdoor", "sold"}
PAID_PREORDER_STATUSES = {Preorder.STATUS_PAID, Preorder.STATUS_CONVERTED}

logger = logging.getLogger(__name__)


def _schedule(callback, *args) -> None:
    def run():
        try:
            callback(*args)
            return
        except Exception as exc:  # noqa: BLE001 - gamification must not break core writes
            logger.exception("Gamification event synchronization failed")
            try:
                from django.db.models import F

                from .models import MetricSyncFailure

                source_type, source_id = _source_identity(callback, args)
                failure, _ = MetricSyncFailure.objects.get_or_create(
                    source_type=source_type,
                    source_id=source_id,
                    defaults={"error_message": str(exc)},
                )
                if failure.attempts:
                    MetricSyncFailure.objects.filter(pk=failure.pk).update(
                        error_message=str(exc),
                        resolved_at=None,
                        attempts=F("attempts") + 1,
                        last_attempt_at=timezone.now(),
                    )
            except Exception:  # noqa: BLE001 - best-effort failure persistence
                logger.exception("Unable to persist gamification sync failure")

    transaction.on_commit(run)


def _source_identity(callback, args) -> tuple[str, str]:
    source_id = str(args[0]) if args else ""
    if callback is _sync_goods:
        return "goods", source_id
    if callback is _sync_preorder:
        return "preorder", source_id
    if callback is _sync_showcase_altar:
        return "showcase_altar", source_id
    return callback.__name__, source_id


def _sync_goods(goods_id, occurred_at=None):
    from .services import sync_goods_source

    sync_goods_source(goods_id, occurred_at=occurred_at)


def _sync_showcase_altar(showcase_id, occurred_at=None):
    from .services import sync_showcase_altar

    sync_showcase_altar(showcase_id, occurred_at=occurred_at)


def _sync_preorder(preorder_id, occurred_at=None):
    from .services import sync_preorder_source

    sync_preorder_source(preorder_id, occurred_at=occurred_at)


def _sync_goods_related_altars(goods_id, occurred_at=None):
    showcase_ids = list(
        ShowcaseGoods.objects.filter(goods_id=goods_id).values_list("showcase_id", flat=True)
    )
    for showcase_id in showcase_ids:
        _sync_showcase_altar(showcase_id, occurred_at)


def _evaluate_user(user_id):
    from .services import evaluate_user

    user = User.objects.filter(pk=user_id).first()
    if user is not None:
        evaluate_user(user)


def _refresh_achievement_users():
    from .services import evaluate_user, is_feature_enabled

    if not is_feature_enabled():
        return
    for user in User.objects.filter(account_type="collector", is_active=True).iterator():
        evaluate_user(user)


def _goods_current_values(goods, *, quantity, price, status):
    eligible = status in ELIGIBLE_GOODS_STATUSES
    current_quantity = quantity if eligible else 0
    current_spend = (
        current_quantity * price
        if eligible and price is not None
        else 0
    )
    return current_quantity, current_spend


@receiver(pre_save, sender=Goods, dispatch_uid="gamification_capture_goods_changed_at")
def capture_goods_changed_at(sender, instance, **kwargs):
    old = (
        Goods.objects.filter(pk=instance.pk)
        .values("status", "quantity", "price", "name", "ip_id", "category_id", "is_official")
        .first()
        if instance.pk
        else None
    )
    old_quantity, old_spend = (
        _goods_current_values(
            instance,
            quantity=old["quantity"],
            price=old["price"],
            status=old["status"],
        )
        if old
        else (0, 0)
    )
    new_quantity, new_spend = _goods_current_values(
        instance,
        quantity=instance.quantity,
        price=instance.price,
        status=instance.status,
    )
    now = timezone.now()
    if new_quantity > old_quantity:
        instance.gamification_quantity_changed_at = now
        instance._gamification_quantity_changed = True
    if new_spend > old_spend:
        instance.gamification_spend_changed_at = now
        instance._gamification_spend_changed = True
    scope_changed = (
        old is None
        or any(
            old[field] != getattr(instance, field)
            for field in ("name", "ip_id", "category_id", "is_official")
        )
    )
    if scope_changed:
        instance.gamification_scope_changed_at = now
        instance._gamification_scope_changed = True


@receiver(pre_save, sender=Preorder, dispatch_uid="gamification_capture_preorder_changed_at")
def capture_preorder_changed_at(sender, instance, **kwargs):
    old = (
        Preorder.objects.filter(pk=instance.pk)
        .values("status", "deposit_amount", "balance_amount")
        .first()
        if instance.pk
        else None
    )

    def current_spend(status, deposit, balance):
        if status not in PAID_PREORDER_STATUSES:
            return 0
        return deposit + (balance or 0)

    old_spend = (
        current_spend(old["status"], old["deposit_amount"], old["balance_amount"])
        if old
        else 0
    )
    new_spend = current_spend(instance.status, instance.deposit_amount, instance.balance_amount)
    if new_spend > old_spend:
        instance.gamification_spend_changed_at = timezone.now()
        instance._gamification_spend_changed = True


@receiver(post_save, sender=Goods, dispatch_uid="gamification_sync_goods")
def sync_goods(sender, instance, **kwargs):
    updates = {}
    if getattr(instance, "_gamification_quantity_changed", False):
        updates["gamification_quantity_changed_at"] = instance.gamification_quantity_changed_at
    if getattr(instance, "_gamification_spend_changed", False):
        updates["gamification_spend_changed_at"] = instance.gamification_spend_changed_at
    if getattr(instance, "_gamification_scope_changed", False):
        updates["gamification_scope_changed_at"] = instance.gamification_scope_changed_at
    if updates:
        Goods.objects.filter(pk=instance.pk).update(**updates)
    occurred_at = timezone.now()
    _schedule(_sync_goods, instance.pk, occurred_at)
    _schedule(_sync_goods_related_altars, instance.pk, occurred_at)


@receiver(m2m_changed, sender=Goods.characters.through, dispatch_uid="gamification_sync_goods_characters")
def sync_goods_characters(sender, instance, action, pk_set, **kwargs):
    if action not in {"post_add", "post_remove", "post_clear"}:
        return
    occurred_at = timezone.now()
    Goods.objects.filter(pk=instance.pk).update(
        gamification_scope_changed_at=occurred_at
    )
    instance.gamification_scope_changed_at = occurred_at
    _schedule(_sync_goods, instance.pk, occurred_at)
    _schedule(_sync_goods_related_altars, instance.pk, occurred_at)


@receiver(post_save, sender=Preorder, dispatch_uid="gamification_sync_preorder")
def sync_preorder(sender, instance, **kwargs):
    if getattr(instance, "_gamification_spend_changed", False):
        Preorder.objects.filter(pk=instance.pk).update(
            gamification_spend_changed_at=instance.gamification_spend_changed_at
        )
    _schedule(_sync_preorder, instance.pk, timezone.now())


@receiver(post_save, sender=Showcase, dispatch_uid="gamification_sync_showcase")
def sync_showcase(sender, instance, **kwargs):
    _schedule(_sync_showcase_altar, instance.pk, timezone.now())


@receiver(post_save, sender=ShowcaseGoods, dispatch_uid="gamification_sync_showcase_goods")
def sync_showcase_goods(sender, instance, **kwargs):
    _schedule(_sync_showcase_altar, instance.showcase_id, timezone.now())


@receiver(post_save, sender=User, dispatch_uid="gamification_initialize_user_states")
def initialize_user_states(sender, instance, created, **kwargs):
    if created:
        _schedule(_evaluate_user, instance.pk)


@receiver(post_save, sender=AchievementSet, dispatch_uid="gamification_sync_set_limited")
def sync_set_limited(sender, instance, **kwargs):
    def update_children():
        Achievement.objects.filter(set=instance).exclude(is_limited=instance.is_limited).update(
            is_limited=instance.is_limited
        )
        _refresh_achievement_users()

    transaction.on_commit(update_children)


@receiver(post_save, sender=Achievement, dispatch_uid="gamification_refresh_achievement_users")
def refresh_achievement_users(sender, instance, **kwargs):
    _schedule(_refresh_achievement_users)
