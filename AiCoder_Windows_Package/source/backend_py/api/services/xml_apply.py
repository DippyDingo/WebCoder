from pathlib import Path
from xml.etree import ElementTree as StdElementTree

from . import files, git_ops
from .errors import ApiError
from .path_utils import safe_join

try:  # pragma: no cover - optional dependency path
    from defusedxml import ElementTree as SafeElementTree
except ImportError:  # pragma: no cover - fallback path
    SafeElementTree = None


def _parse_xml(xml_content):
    parser = SafeElementTree if SafeElementTree is not None else StdElementTree
    try:
        return parser.fromstring(xml_content)
    except Exception as exc:
        raise ApiError(str(exc), status_code=500) from exc


def normalize_xml_content(xml_content):
    content = (xml_content or "").strip()
    if content.startswith("```xml"):
        content = content[len("```xml"):].strip()
    if content.startswith("```"):
        content = content[len("```"):].strip()
    if content.endswith("```"):
        content = content[:-3].strip()
    return content


def apply_ai_response(root_path, xml_content):
    root_path = Path(root_path)
    normalized_xml = normalize_xml_content(xml_content)
    response = _parse_xml(normalized_xml)

    modified_files = []
    for change in response.findall("file_change"):
        action = (change.attrib.get("action") or "").strip()
        relative_path = (change.attrib.get("path") or "").strip()
        if not relative_path:
            raise ApiError("file_change path is required", status_code=500)

        full_path, normalized_path = safe_join(root_path, relative_path)
        if action == "delete":
            if full_path.exists():
                full_path.unlink()
        else:
            content = (change.text or "").strip()
            files.write_file_content(root_path, normalized_path, content)

        modified_files.append(normalized_path)

    commit_message = (response.findtext("commit_message") or "").strip()
    if commit_message:
        try:
            git_ops.git_commit(root_path, commit_message)
        except ApiError as exc:
            return modified_files, f"Changes applied, but commit failed: {exc}"

    return modified_files, f"Success! {commit_message}".strip()
