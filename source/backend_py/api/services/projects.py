import re
import subprocess

from .errors import ApiError
from .settings_service import initialize_project_files
from .runtime import get_legacy_project_name, get_projects_dir

PROJECT_NAME_RE = re.compile(r"^[a-z0-9-]+$")


def list_projects(state):
    names = []
    legacy_project_name = get_legacy_project_name(state.base_dir)
    if legacy_project_name:
        names.append(legacy_project_name)

    projects_dir = state.projects_dir or get_projects_dir(state.base_dir)
    if not projects_dir.is_dir():
        return names

    for entry in sorted(projects_dir.iterdir(), key=lambda item: item.name.lower()):
        if entry.is_dir() and not entry.name.startswith(".") and entry.name not in names:
            names.append(entry.name)
    return names


def create_project(state, name):
    if not PROJECT_NAME_RE.match(name):
        raise ApiError("Invalid name: use only a-z, 0-9 and -", status_code=400)

    projects_dir = state.projects_dir or get_projects_dir(state.base_dir)
    projects_dir.mkdir(parents=True, exist_ok=True)

    legacy_project_name = get_legacy_project_name(state.base_dir)
    if legacy_project_name and name == legacy_project_name:
        raise ApiError("Project already exists", status_code=400)

    new_project_path = (projects_dir / name).resolve()
    if new_project_path.exists():
        raise ApiError("Project already exists", status_code=400)

    new_project_path.mkdir(parents=True, exist_ok=False)
    subprocess.run(["git", "init", str(new_project_path)], check=False, capture_output=True, text=True)
    initialize_project_files(new_project_path, state.base_dir, name)
    subprocess.run(["git", "add", "."], cwd=new_project_path, check=False, capture_output=True, text=True)
    subprocess.run(["git", "commit", "-m", "Init"], cwd=new_project_path, check=False, capture_output=True, text=True)
