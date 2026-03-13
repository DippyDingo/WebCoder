import shutil
from pathlib import PurePosixPath

from .errors import ApiError
from .path_utils import safe_join


def match_pattern(path, pattern):
    if not pattern:
        return False
    pure_path = PurePosixPath(path)
    pure_pattern = pattern.replace("\\", "/")
    return pure_path.match(pure_pattern)


def is_path_selected(path, focus_patterns):
    for pattern in focus_patterns:
        if pattern.startswith("!"):
            clean_pattern = pattern[1:]
            if clean_pattern == path or match_pattern(path, clean_pattern):
                return False

    for pattern in focus_patterns:
        if pattern.startswith("!"):
            continue
        if pattern == path or match_pattern(path, pattern) or path.startswith(f"{pattern}/"):
            return True

    return False


def list_files(root_path, sub_path, settings_payload):
    full_path, prefix = safe_join(root_path, sub_path)
    if not full_path.exists():
        return []

    nodes = []
    for entry in sorted(full_path.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
        rel_parts = [part for part in [prefix, entry.name] if part]
        rel_path = "/".join(rel_parts)

        ignored = any(match_pattern(rel_path, pattern) for pattern in settings_payload["ignore_patterns"])
        if ignored:
            continue

        nodes.append(
            {
                "name": entry.name,
                "path": rel_path,
                "is_dir": entry.is_dir(),
                "selected": is_path_selected(rel_path, settings_payload["context_focus"]),
            }
        )

    return nodes


def list_files_recursive(root_path, sub_path, settings_payload):
    result = []
    for node in list_files(root_path, sub_path, settings_payload):
        result.append(node)
        if node["is_dir"]:
            result.extend(list_files_recursive(root_path, node["path"], settings_payload))
    return result


def read_file_content(root_path, relative_path):
    full_path, _ = safe_join(root_path, relative_path)
    if not full_path.is_file():
        raise FileNotFoundError(relative_path)
    return full_path.read_bytes().decode("utf-8", errors="replace")


def write_file_content(root_path, relative_path, content):
    full_path, _ = safe_join(root_path, relative_path)
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content, encoding="utf-8")


def create_path(root_path, relative_path, node_type):
    full_path, normalized_path = safe_join(root_path, relative_path)
    if not normalized_path:
        raise ApiError("Path is required", status_code=400)
    if full_path.exists():
        raise ApiError("Path already exists", status_code=400)

    if node_type == "folder":
        full_path.mkdir(parents=True, exist_ok=False)
        return

    if node_type != "file":
        raise ApiError("Unsupported node type", status_code=400)

    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text("", encoding="utf-8")


def delete_path(root_path, relative_path):
    full_path, normalized_path = safe_join(root_path, relative_path)
    if not normalized_path:
        raise ApiError("Path is required", status_code=400)
    if normalized_path.startswith(".aicoder/history/"):
        raise ApiError("History previews cannot be deleted", status_code=400)
    if not full_path.exists():
        raise FileNotFoundError(relative_path)

    if full_path.is_dir():
        shutil.rmtree(full_path)
        return

    full_path.unlink()


def calculate_stats(root_path, settings_payload):
    stats = {"files_count": 0, "total_size": 0}
    for node in list_files_recursive(root_path, "", settings_payload):
        if node["is_dir"] or not node["selected"]:
            continue
        full_path, _ = safe_join(root_path, node["path"])
        if full_path.exists():
            stats["files_count"] += 1
            stats["total_size"] += full_path.stat().st_size
    return stats
