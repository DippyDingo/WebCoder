from pathlib import Path, PurePosixPath

from .errors import ApiError


def normalize_relative_path(relative_path):
    raw = (relative_path or "").replace("\\", "/").strip("/")
    if raw in {"", "."}:
        return Path(), ""

    pure_path = PurePosixPath(raw)
    if pure_path.is_absolute():
        raise ApiError("Absolute paths are not allowed", status_code=400)

    parts = []
    for part in pure_path.parts:
        if part in {"", "."}:
            continue
        if part == "..":
            raise ApiError("Path traversal is not allowed", status_code=400)
        parts.append(part)

    filesystem_path = Path(*parts)
    posix_path = PurePosixPath(*parts).as_posix() if parts else ""
    return filesystem_path, posix_path


def safe_join(root, relative_path=""):
    root = Path(root).resolve()
    filesystem_path, posix_path = normalize_relative_path(relative_path)
    candidate = (root / filesystem_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ApiError("Path traversal is not allowed", status_code=400)
    return candidate, posix_path
