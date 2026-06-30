from django.contrib import admin

from .models import StorageNode


@admin.register(StorageNode)
class StorageNodeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "node_type", "parent", "path_name", "capacity", "is_favorite", "order")
    list_filter = ("node_type", "is_favorite", "parent")
    search_fields = ("name", "code", "path_name")
    ordering = ("path_name", "order")
    list_per_page = 100

