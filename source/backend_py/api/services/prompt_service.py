from pathlib import Path

from . import files
from .settings_service import AICODER_DIR, DEFAULT_PROMPT_TEMPLATE, load_prompt_template

LEGACY_PLACEHOLDER = (
    "Мне нужно чтобы шаблоны prompt и settings брались только из файлов prompt.md и settings.json "
    "которые рядом с ./aicoder, а в коде убери содержимое."
)


def generate_prompt(root_path, task, settings_payload, base_dir=None):
    root_path = Path(root_path)
    file_xml_parts = []

    for node in files.list_files_recursive(root_path, "", settings_payload):
        if node["is_dir"] or not node["selected"]:
            continue
        try:
            content = files.read_file_content(root_path, node["path"])
        except OSError:
            continue
        file_xml_parts.append(f'<file path="{node["path"]}">\n<![CDATA[\n{content}\n]]>\n</file>')

    template = load_prompt_template(root_path, base_dir=base_dir) or DEFAULT_PROMPT_TEMPLATE
    final_prompt = template.replace("{{TASK}}", task)
    final_prompt = final_prompt.replace(LEGACY_PLACEHOLDER, task)
    final_prompt = final_prompt.replace("{{FILES_XML}}", "\n".join(file_xml_parts))

    aicoder_dir = root_path / AICODER_DIR
    aicoder_dir.mkdir(parents=True, exist_ok=True)
    (aicoder_dir / "source.txt").write_text(final_prompt, encoding="utf-8")
    return final_prompt
