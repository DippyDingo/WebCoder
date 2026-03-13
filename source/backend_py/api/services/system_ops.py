import os
import platform
import subprocess
from pathlib import Path

from django.conf import settings

from .errors import ApiError
from .git_ops import check_git_availability, check_git_config
from .path_utils import safe_join


def check_write_permissions(directory):
    test_file = Path(directory) / ".perm_check"
    try:
        test_file.write_text("ok", encoding="utf-8")
    except OSError:
        return False
    finally:
        try:
            test_file.unlink()
        except OSError:
            pass
    return True


def check_system(base_dir):
    return {
        "git_installed": check_git_availability(),
        "git_configured": check_git_config(),
        "permissions": check_write_permissions(base_dir),
        "os": platform.system().lower(),
    }


def open_path(project_root, relative_path):
    if not settings.AICODER_LOCAL_MODE:
        raise ApiError("System open disabled outside local mode", status_code=400)

    full_path, _ = safe_join(project_root, relative_path)

    if os.name == "nt":
        command = ["explorer", f"/select,{full_path}"]
    elif platform.system().lower() == "darwin":
        command = ["open", "-R", str(full_path)]
    else:
        command = ["xdg-open", str(full_path.parent)]

    subprocess.run(command, check=False, capture_output=True, text=True)
