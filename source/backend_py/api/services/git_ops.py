import re
import shutil
import string
import subprocess

from .errors import ApiError

GIT_TEXT_ENCODING = "utf-8"
FIELD_SEPARATOR = "\x1f"
RECORD_SEPARATOR = "\x1e"
CP1251_MOJIBAKE_RE = re.compile(r"[РС][\u0400-\u04FF\u2018-\u201F\u00AB\u00BB\u2116]")
LATIN1_MOJIBAKE_RE = re.compile(r"[ÐÑ][\u0080-\u00FF]")
CONTROL_CHAR_RE = re.compile(r"[\x00-\x1F\x7F-\x9F]")
COMMIT_HASH_RE = re.compile(r"^[0-9a-fA-F]{4,40}$")


def _text_quality(value):
    allowed_punctuation = " .,;:!?()[]{}<>/-_\"'`@#%&*+=|\\"
    readable = sum(
        1
        for char in value
        if char.isalnum()
        or char.isspace()
        or char in allowed_punctuation
        or char in string.printable
    )
    suspicious = (
        len(CP1251_MOJIBAKE_RE.findall(value))
        + len(LATIN1_MOJIBAKE_RE.findall(value))
        + len(CONTROL_CHAR_RE.findall(value))
        + value.count("\ufffd")
    )
    return readable - (suspicious * 4)


def repair_mojibake(value):
    if not value:
        return value

    best_value = value
    best_quality = _text_quality(value)

    for encoding in ("cp1251", "latin1"):
        try:
            candidate = value.encode(encoding, errors="strict").decode("utf-8", errors="strict")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        candidate_quality = _text_quality(candidate)
        if candidate_quality > best_quality:
            best_value = candidate
            best_quality = candidate_quality
    return best_value


def run_git(args, cwd=None, check=True):
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=check,
        capture_output=True,
        text=True,
        encoding=GIT_TEXT_ENCODING,
        errors="replace",
    )


def check_git_availability():
    return shutil.which("git") is not None


def check_git_config():
    if not check_git_availability():
        return False
    try:
        result = run_git(["var", "GIT_AUTHOR_IDENT"], check=True)
    except subprocess.CalledProcessError:
        return False
    return bool(result.stdout.strip())


def get_git_log(root_path, limit, offset):
    try:
        limit_value = int(limit)
    except (TypeError, ValueError):
        limit_value = 20
    try:
        offset_value = int(offset)
    except (TypeError, ValueError):
        offset_value = 0

    if limit_value <= 0:
        limit_value = 20
    if offset_value < 0:
        offset_value = 0

    args = [
        "-c",
        "i18n.logOutputEncoding=utf-8",
        "log",
        "--encoding=UTF-8",
        f"--pretty=format:%h{FIELD_SEPARATOR}%s{FIELD_SEPARATOR}%an{FIELD_SEPARATOR}%ad{RECORD_SEPARATOR}",
        "--date=format:%Y-%m-%d %H:%M",
        "-n",
        str(limit_value),
    ]
    if offset_value:
        args.append(f"--skip={offset_value}")

    try:
        result = run_git(args, cwd=root_path, check=True)
    except subprocess.CalledProcessError:
        return []

    commits = []
    for record in result.stdout.split(RECORD_SEPARATOR):
        line = record.strip()
        if not line:
            continue
        parts = line.split(FIELD_SEPARATOR)
        if len(parts) >= 4:
            commits.append(
                {
                    "hash": parts[0],
                    "message": repair_mojibake(parts[1]),
                    "author": repair_mojibake(parts[2]),
                    "date": parts[3],
                }
            )
    return commits


def get_commit_preview(root_path, commit_hash):
    if not COMMIT_HASH_RE.fullmatch(commit_hash or ""):
        raise ApiError("Invalid commit hash", status_code=400)

    args = [
        "-c",
        "i18n.logOutputEncoding=utf-8",
        "show",
        "--encoding=UTF-8",
        "--stat",
        "--patch",
        "--find-renames",
        "--format=fuller",
        commit_hash,
    ]

    try:
        result = run_git(args, cwd=root_path, check=True)
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise ApiError(stderr, status_code=404) from exc

    return repair_mojibake(result.stdout)


def git_commit(root_path, message):
    try:
        run_git(["add", "."], cwd=root_path, check=True)
        run_git(
            [
                "-c",
                "i18n.commitEncoding=utf-8",
                "commit",
                "-m",
                message,
            ],
            cwd=root_path,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise ApiError(stderr, status_code=500) from exc


def git_amend_commit_message(root_path, message):
    if not (message or "").strip():
        raise ApiError("Commit message is required", status_code=400)

    try:
        run_git(
            [
                "-c",
                "i18n.commitEncoding=utf-8",
                "commit",
                "--amend",
                "--only",
                "-m",
                message.strip(),
            ],
            cwd=root_path,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise ApiError(stderr, status_code=500) from exc


def git_reset(root_path, commit_hash):
    try:
        run_git(["reset", "--hard", commit_hash], cwd=root_path, check=True)
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise ApiError(stderr, status_code=500) from exc
