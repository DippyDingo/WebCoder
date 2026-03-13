from django.urls import path

from . import views

urlpatterns = [
    path("state", views.get_state),
    path("projects", views.list_projects),
    path("project/create", views.create_project),
    path("project/open", views.open_project),
    path("project/close", views.close_project),
    path("system/check", views.system_check),
    path("system/open", views.system_open),
    path("log", views.client_log),
    path("git/log", views.git_log),
    path("git/show", views.git_show),
    path("git/commit", views.git_commit),
    path("git/amend", views.git_amend),
    path("git/reset", views.git_reset),
    path("prompt/generate", views.generate_prompt),
    path("ai/apply", views.apply_changes),
    path("fs/list", views.list_files),
    path("fs/stats", views.get_stats),
    path("fs/create", views.create_fs_entry),
    path("fs/delete", views.delete_fs_entry),
    path("file", views.file_endpoint),
    path("settings", views.settings_endpoint),
]
