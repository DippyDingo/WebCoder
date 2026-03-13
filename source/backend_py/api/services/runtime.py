from dataclasses import dataclass
from pathlib import Path

from django.conf import settings

from .errors import ApiError
from .settings_service import get_aicoder_dir, load_settings

SESSION_MODE = "aicoder_mode"
SESSION_CURRENT_PROJECT_ROOT = "aicoder_current_project_root"


@dataclass
class AppState:
    base_dir: Path
    projects_dir: Path | None
    current_project_root: Path | None
    mode: str


def get_base_dir():
    return Path(settings.AICODER_WORKDIR).resolve()


def get_projects_dir(base_dir: Path) -> Path:
    return (base_dir / "projects").resolve()


def has_legacy_workspace(base_dir: Path) -> bool:
    return get_aicoder_dir(base_dir).exists()


def get_legacy_project_name(base_dir: Path) -> str | None:
    if not has_legacy_workspace(base_dir):
        return None

    try:
        settings_payload = load_settings(base_dir)
        return settings_payload.get("project_name") or base_dir.name
    except Exception:
        return base_dir.name


def initialize_session_state(request, force=False):
    base_dir = get_base_dir()
    projects_dir = get_projects_dir(base_dir)

    if projects_dir.is_dir():
        default_mode = "dashboard"
        default_root = ""
    else:
        default_mode = "workspace"
        default_root = str(base_dir)

    if force or SESSION_MODE not in request.session:
        request.session[SESSION_MODE] = default_mode
    if force or SESSION_CURRENT_PROJECT_ROOT not in request.session:
        request.session[SESSION_CURRENT_PROJECT_ROOT] = default_root

    current_root = request.session.get(SESSION_CURRENT_PROJECT_ROOT, "")
    if current_root and not Path(current_root).exists():
        request.session[SESSION_CURRENT_PROJECT_ROOT] = ""
        if projects_dir.is_dir():
            request.session[SESSION_MODE] = "dashboard"

    request.session.modified = True


def get_app_state(request, require_workspace=False):
    initialize_session_state(request)
    base_dir = get_base_dir()
    projects_dir = get_projects_dir(base_dir)
    projects_dir = projects_dir if projects_dir.is_dir() else None

    mode = request.session.get(SESSION_MODE, "dashboard")
    current_root_raw = request.session.get(SESSION_CURRENT_PROJECT_ROOT, "")
    current_project_root = Path(current_root_raw).resolve() if current_root_raw else None

    if current_project_root is not None:
        is_projects_child = projects_dir is not None and (
            current_project_root == projects_dir or projects_dir in current_project_root.parents
        )
        is_legacy_root = current_project_root == base_dir and (
            has_legacy_workspace(base_dir) or projects_dir is None
        )
        if not is_projects_child and not is_legacy_root:
            raise ApiError("Invalid active project", status_code=400)

    if require_workspace and not current_project_root:
        raise ApiError("No active project", status_code=400)

    return AppState(
        base_dir=base_dir,
        projects_dir=projects_dir,
        current_project_root=current_project_root,
        mode=mode,
    )


def get_project_name(project_root):
    return Path(project_root).name if project_root else ""


def open_project(request, name):
    state = get_app_state(request)
    legacy_project_name = get_legacy_project_name(state.base_dir)
    if legacy_project_name and name == legacy_project_name:
        request.session[SESSION_CURRENT_PROJECT_ROOT] = str(state.base_dir)
        request.session[SESSION_MODE] = "workspace"
        request.session.modified = True
        return

    if not state.projects_dir:
        raise ApiError("Project not found", status_code=404)

    target = (state.projects_dir / name).resolve()
    if not target.is_dir() or state.projects_dir not in target.parents:
        raise ApiError("Project not found", status_code=404)

    request.session[SESSION_CURRENT_PROJECT_ROOT] = str(target)
    request.session[SESSION_MODE] = "workspace"
    request.session.modified = True


def close_project(request):
    get_app_state(request)
    request.session[SESSION_MODE] = "dashboard"
    request.session[SESSION_CURRENT_PROJECT_ROOT] = ""
    request.session.modified = True
