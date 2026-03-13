import json
from copy import deepcopy
from pathlib import Path

from .errors import ApiError

AICODER_DIR = ".aicoder"
SETTINGS_FILE_NAME = "settings.json"
PROMPT_FILE_NAME = "prompt.md"
DEFAULT_PROMPT_TEMPLATE = ""

DEFAULT_SETTINGS = {
    "project_name": "Untitled Project",
    "ignore_patterns": [],
    "context_focus": [],
    "max_file_size_kb": 100,
}


def new_settings(project_name=None):
    payload = deepcopy(DEFAULT_SETTINGS)
    if project_name:
        payload["project_name"] = project_name
    return payload


def normalize_settings(payload, project_name=None):
    normalized = new_settings(project_name=project_name or payload.get("project_name"))
    normalized["ignore_patterns"] = list(payload.get("ignore_patterns", normalized["ignore_patterns"]))
    normalized["context_focus"] = list(payload.get("context_focus", normalized["context_focus"]))
    normalized["max_file_size_kb"] = int(payload.get("max_file_size_kb", normalized["max_file_size_kb"]))
    normalized["project_name"] = payload.get("project_name") or normalized["project_name"]
    return normalized


def get_aicoder_dir(project_root):
    return Path(project_root) / AICODER_DIR


def get_settings_path(project_root):
    return get_aicoder_dir(project_root) / SETTINGS_FILE_NAME


def get_prompt_path(project_root):
    return get_aicoder_dir(project_root) / PROMPT_FILE_NAME


def save_settings(project_root, payload):
    project_root = Path(project_root)
    settings_path = get_settings_path(project_root)
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    normalized = normalize_settings(payload, project_name=payload.get("project_name") or project_root.name)
    settings_path.write_text(json.dumps(normalized, indent=2), encoding="utf-8")
    return normalized


def load_settings(project_root):
    project_root = Path(project_root)
    settings_path = get_settings_path(project_root)
    if not settings_path.exists():
        return save_settings(project_root, new_settings(project_name=project_root.name))

    try:
        payload = json.loads(settings_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ApiError(f"Invalid settings.json: {exc}", status_code=500) from exc

    return normalize_settings(payload, project_name=payload.get("project_name") or project_root.name)


def load_master_settings(base_dir):
    master_path = Path(base_dir) / SETTINGS_FILE_NAME
    if not master_path.exists():
        return None

    try:
        payload = json.loads(master_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None

    return normalize_settings(payload, project_name=payload.get("project_name"))


def load_prompt_template(project_root, base_dir=None):
    project_prompt = get_prompt_path(project_root)
    if project_prompt.exists():
        return project_prompt.read_text(encoding="utf-8")

    workspace_prompt = Path(project_root) / PROMPT_FILE_NAME
    if workspace_prompt.exists():
        return workspace_prompt.read_text(encoding="utf-8")

    if base_dir:
        base_prompt = Path(base_dir) / PROMPT_FILE_NAME
        if base_prompt.exists():
            return base_prompt.read_text(encoding="utf-8")

    return DEFAULT_PROMPT_TEMPLATE


def initialize_project_files(project_root, base_dir, project_name):
    payload = load_master_settings(base_dir) or new_settings(project_name=project_name)
    payload["project_name"] = project_name
    save_settings(project_root, payload)

    prompt_content = load_prompt_template(project_root, base_dir=base_dir)
    prompt_path = get_prompt_path(project_root)
    prompt_path.parent.mkdir(parents=True, exist_ok=True)
    prompt_path.write_text(prompt_content, encoding="utf-8")
