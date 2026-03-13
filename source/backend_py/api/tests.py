import json
import shutil
import subprocess
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

from django.test import Client, SimpleTestCase, TestCase, override_settings

from .services import files, git_ops, prompt_service, settings_service, xml_apply
from .services.errors import ApiError


def write_text(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


@contextmanager
def workspace_tempdir():
    temp_root = Path(__file__).resolve().parents[3] / ".tmp-tests"
    temp_root.mkdir(parents=True, exist_ok=True)
    temp_dir = temp_root / f"case-{uuid4().hex}"
    temp_dir.mkdir(parents=True, exist_ok=False)
    try:
        yield str(temp_dir)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


class PathSafetyTests(SimpleTestCase):
    def test_safe_join_rejects_path_traversal(self):
        with workspace_tempdir() as temp_dir:
            with self.assertRaises(ApiError):
                files.read_file_content(Path(temp_dir), "../secret.txt")


class ServiceTests(TestCase):
    def test_create_and_delete_path_support_files_and_folders(self):
        with workspace_tempdir() as temp_dir:
            project_root = Path(temp_dir)

            files.create_path(project_root, "notes/todo.txt", "file")
            self.assertTrue((project_root / "notes" / "todo.txt").is_file())

            files.create_path(project_root, "notes/archive", "folder")
            self.assertTrue((project_root / "notes" / "archive").is_dir())

            files.delete_path(project_root, "notes")
            self.assertFalse((project_root / "notes").exists())

    def test_git_log_repairs_mojibake_commit_message(self):
        expected_message = (
            "\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e "
            "\u043d\u043e\u0432\u043e\u0435 "
            "\u0441\u0442\u0438\u0445\u043e\u0442\u0432\u043e\u0440\u0435\u043d\u0438\u0435 "
            "\u0432 \u0444\u0430\u0439\u043b poem.txt"
        )
        mojibake_message = expected_message.encode("utf-8").decode("cp1251")
        mocked_result = Mock(
            stdout=f"8b04773\x1f{mojibake_message}\x1fAlexey Melnikov\x1f2026-03-13 02:04\x1e"
        )

        with patch("api.services.git_ops.run_git", return_value=mocked_result):
            commits = git_ops.get_git_log(Path("."), 5, 0)

        self.assertEqual(commits[0]["message"], expected_message)

    def test_generate_prompt_uses_selected_context(self):
        with workspace_tempdir() as temp_dir:
            project_root = Path(temp_dir)
            settings_payload = settings_service.normalize_settings(
                {
                    "project_name": "demo",
                    "ignore_patterns": [".aicoder"],
                    "context_focus": ["src/main.py"],
                    "max_file_size_kb": 100,
                },
                project_name="demo",
            )
            write_text(project_root / "src" / "main.py", "print('hi')\n")
            write_text(project_root / "README.md", "ignore me\n")
            settings_service.save_settings(project_root, settings_payload)
            write_text(project_root / ".aicoder" / "prompt.md", "TASK={{TASK}}\nFILES={{FILES_XML}}")

            prompt = prompt_service.generate_prompt(project_root, "say hi", settings_payload)

            self.assertIn("say hi", prompt)
            self.assertIn('path="src/main.py"', prompt)
            self.assertNotIn('path="README.md"', prompt)
            self.assertTrue((project_root / ".aicoder" / "source.txt").exists())

    def test_generate_prompt_falls_back_to_workspace_prompt(self):
        with workspace_tempdir() as temp_dir:
            project_root = Path(temp_dir)
            settings_payload = settings_service.normalize_settings(
                {
                    "project_name": "demo",
                    "ignore_patterns": [],
                    "context_focus": [],
                    "max_file_size_kb": 100,
                },
                project_name="demo",
            )
            settings_service.save_settings(project_root, settings_payload)
            write_text(project_root / "prompt.md", "TASK={{TASK}}")

            prompt = prompt_service.generate_prompt(project_root, "cats", settings_payload)

            self.assertEqual(prompt, "TASK=cats")

    @unittest.skipUnless(shutil.which("git"), "git is required")
    def test_apply_xml_writes_and_commits(self):
        with workspace_tempdir() as temp_dir:
            project_root = Path(temp_dir)
            subprocess.run(["git", "init"], cwd=project_root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=project_root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=project_root, check=True, capture_output=True)

            changed_files, message = xml_apply.apply_ai_response(
                project_root,
                """```xml
<response>
  <file_change action="write" path="hello.txt"><![CDATA[hello]]></file_change>
  <commit_message>Init hello</commit_message>
</response>
```""",
            )

            self.assertEqual(changed_files, ["hello.txt"])
            self.assertIn("Init hello", message)
            self.assertEqual((project_root / "hello.txt").read_text(encoding="utf-8"), "hello")

    @unittest.skipUnless(shutil.which("git"), "git is required")
    def test_git_log_preserves_russian_commit_message(self):
        expected_message = (
            "\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e "
            "\u043d\u043e\u0432\u043e\u0435 "
            "\u0441\u0442\u0438\u0445\u043e\u0442\u0432\u043e\u0440\u0435\u043d\u0438\u0435 "
            "\u0432 \u0444\u0430\u0439\u043b poem.txt"
        )
        with workspace_tempdir() as temp_dir:
            project_root = Path(temp_dir)
            subprocess.run(["git", "init"], cwd=project_root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=project_root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=project_root, check=True, capture_output=True)
            write_text(project_root / "poem.txt", "\u043a\u043e\u0442\u044b\n")

            git_ops.git_commit(project_root, expected_message)
            commits = git_ops.get_git_log(project_root, 10, 0)

            self.assertTrue(commits)
            self.assertEqual(commits[0]["message"], expected_message)

    @unittest.skipUnless(shutil.which("git"), "git is required")
    def test_get_commit_preview_returns_diff_text(self):
        with workspace_tempdir() as temp_dir:
            project_root = Path(temp_dir)
            subprocess.run(["git", "init"], cwd=project_root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=project_root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=project_root, check=True, capture_output=True)
            write_text(project_root / "hello.txt", "hello\n")
            git_ops.git_commit(project_root, "Init hello")

            commit_hash = git_ops.get_git_log(project_root, 1, 0)[0]["hash"]
            preview = git_ops.get_commit_preview(project_root, commit_hash)

            self.assertIn("Init hello", preview)
            self.assertIn("diff --git", preview)
            self.assertIn("hello.txt", preview)

    @unittest.skipUnless(shutil.which("git"), "git is required")
    def test_git_amend_commit_message_updates_head(self):
        with workspace_tempdir() as temp_dir:
            project_root = Path(temp_dir)
            subprocess.run(["git", "init"], cwd=project_root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=project_root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=project_root, check=True, capture_output=True)
            write_text(project_root / "hello.txt", "hello\n")
            git_ops.git_commit(project_root, "Init hello")

            git_ops.git_amend_commit_message(project_root, "Renamed commit")
            commits = git_ops.get_git_log(project_root, 1, 0)

            self.assertEqual(commits[0]["message"], "Renamed commit")


class ApiTests(TestCase):
    def setUp(self):
        self.temp_dir = workspace_tempdir()
        self.base_dir = Path(self.temp_dir.__enter__())
        (self.base_dir / "projects").mkdir()
        write_text(self.base_dir / "settings.json", json.dumps({"ignore_patterns": [".git", ".aicoder"]}))
        write_text(self.base_dir / "prompt.md", "TASK={{TASK}}\n{{FILES_XML}}")
        self.client_one = Client()
        self.client_two = Client()

    def tearDown(self):
        self.temp_dir.__exit__(None, None, None)

    def test_session_state_is_isolated_between_clients(self):
        with override_settings(AICODER_WORKDIR=self.base_dir):
            response = self.client_one.post("/api/project/create", data=json.dumps({"name": "alpha"}), content_type="application/json")
            self.assertEqual(response.status_code, 200)

            self.client_one.post("/api/project/open", data=json.dumps({"name": "alpha"}), content_type="application/json")

            state_one = self.client_one.get("/api/state").json()
            state_two = self.client_two.get("/api/state").json()

            self.assertEqual(state_one["mode"], "workspace")
            self.assertEqual(state_one["project_name"], "alpha")
            self.assertEqual(state_two["mode"], "dashboard")

    def test_invalid_xml_returns_error(self):
        with override_settings(AICODER_WORKDIR=self.base_dir):
            self.client_one.post("/api/project/create", data=json.dumps({"name": "alpha"}), content_type="application/json")
            self.client_one.post("/api/project/open", data=json.dumps({"name": "alpha"}), content_type="application/json")

            response = self.client_one.post(
                "/api/ai/apply",
                data=json.dumps({"xml_content": "<response>"}),
                content_type="application/json",
            )

            self.assertEqual(response.status_code, 500)
            self.assertIn("message", response.json())

    def test_file_write_rejects_path_traversal(self):
        with override_settings(AICODER_WORKDIR=self.base_dir):
            self.client_one.post("/api/project/create", data=json.dumps({"name": "alpha"}), content_type="application/json")
            self.client_one.post("/api/project/open", data=json.dumps({"name": "alpha"}), content_type="application/json")

            response = self.client_one.post(
                "/api/file",
                data=json.dumps({"path": "../oops.txt", "content": "bad"}),
                content_type="application/json",
            )

            self.assertEqual(response.status_code, 400)

    def test_fs_create_and_delete_manage_workspace_entries(self):
        with override_settings(AICODER_WORKDIR=self.base_dir):
            self.client_one.post("/api/project/create", data=json.dumps({"name": "alpha"}), content_type="application/json")
            self.client_one.post("/api/project/open", data=json.dumps({"name": "alpha"}), content_type="application/json")

            create_folder = self.client_one.post(
                "/api/fs/create",
                data=json.dumps({"path": "docs", "type": "folder"}),
                content_type="application/json",
            )
            create_file = self.client_one.post(
                "/api/fs/create",
                data=json.dumps({"path": "docs/readme.txt", "type": "file"}),
                content_type="application/json",
            )

            self.assertEqual(create_folder.status_code, 200)
            self.assertEqual(create_file.status_code, 200)
            self.assertTrue((self.base_dir / "projects" / "alpha" / "docs" / "readme.txt").exists())

            delete_folder = self.client_one.post(
                "/api/fs/delete",
                data=json.dumps({"path": "docs"}),
                content_type="application/json",
            )

            self.assertEqual(delete_folder.status_code, 200)
            self.assertFalse((self.base_dir / "projects" / "alpha" / "docs").exists())

    def test_system_open_is_blocked_outside_local_mode(self):
        with override_settings(AICODER_WORKDIR=self.base_dir, AICODER_LOCAL_MODE=False):
            self.client_one.post("/api/project/create", data=json.dumps({"name": "alpha"}), content_type="application/json")
            self.client_one.post("/api/project/open", data=json.dumps({"name": "alpha"}), content_type="application/json")

            response = self.client_one.post(
                "/api/system/open",
                data=json.dumps({"path": ".aicoder/source.txt"}),
                content_type="application/json",
            )

            self.assertEqual(response.status_code, 400)

    def test_prompt_file_endpoint_falls_back_to_workspace_prompt(self):
        with workspace_tempdir() as temp_dir:
            workspace_root = Path(temp_dir)
            write_text(workspace_root / "prompt.md", "PROMPT={{TASK}}")
            write_text(workspace_root / "settings.json", json.dumps({"ignore_patterns": [".git", ".aicoder"]}))

            with override_settings(AICODER_WORKDIR=workspace_root):
                response = self.client_one.get("/api/file?path=.aicoder/prompt.md")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["content"], "PROMPT={{TASK}}")

    def test_dashboard_mode_and_project_list_work_without_projects_dir(self):
        with workspace_tempdir() as temp_dir:
            workspace_root = Path(temp_dir)
            write_text(workspace_root / ".aicoder" / "settings.json", json.dumps({"project_name": "source"}))
            client = Client()

            with override_settings(AICODER_WORKDIR=workspace_root):
                state_before = client.get("/api/state").json()
                self.assertEqual(state_before["mode"], "workspace")

                close_response = client.post("/api/project/close")
                self.assertEqual(close_response.status_code, 200)

                state_after = client.get("/api/state").json()
                projects_response = client.get("/api/projects")

            self.assertEqual(state_after["mode"], "dashboard")
            self.assertEqual(projects_response.status_code, 200)
            self.assertIn("source", projects_response.json())

    def test_create_project_creates_projects_dir_if_missing(self):
        with workspace_tempdir() as temp_dir:
            workspace_root = Path(temp_dir)
            write_text(workspace_root / ".aicoder" / "settings.json", json.dumps({"project_name": "source"}))
            client = Client()

            with override_settings(AICODER_WORKDIR=workspace_root):
                close_response = client.post("/api/project/close")
                self.assertEqual(close_response.status_code, 200)

                create_response = client.post(
                    "/api/project/create",
                    data=json.dumps({"name": "alpha"}),
                    content_type="application/json",
                )

            self.assertEqual(create_response.status_code, 200)
            self.assertTrue((workspace_root / "projects" / "alpha").is_dir())

    @patch("api.services.system_ops.subprocess.run")
    def test_system_open_works_in_local_mode(self, run_mock):
        with override_settings(AICODER_WORKDIR=self.base_dir, AICODER_LOCAL_MODE=True):
            self.client_one.post("/api/project/create", data=json.dumps({"name": "alpha"}), content_type="application/json")
            self.client_one.post("/api/project/open", data=json.dumps({"name": "alpha"}), content_type="application/json")

            response = self.client_one.post(
                "/api/system/open",
                data=json.dumps({"path": ".aicoder/source.txt"}),
                content_type="application/json",
            )

            self.assertEqual(response.status_code, 200)
            run_mock.assert_called()
