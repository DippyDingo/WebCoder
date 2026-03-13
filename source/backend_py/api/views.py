import json
import logging
import mimetypes
from functools import wraps

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .services import files, git_ops, projects, prompt_service, runtime, settings_service, system_ops, xml_apply
from .services.errors import ApiError

logger = logging.getLogger(__name__)


def parse_json_body(request):
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ApiError("Invalid JSON", status_code=400) from exc


def json_response(payload, status=200):
    response = JsonResponse(payload, status=status, safe=not isinstance(payload, list))
    response["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response


def api_view(view_func):
    @csrf_exempt
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        try:
            runtime.initialize_session_state(request)
            return view_func(request, *args, **kwargs)
        except ApiError as exc:
            logger.warning("API error: %s", exc)
            return json_response({"message": str(exc)}, status=exc.status_code)
        except FileNotFoundError:
            return json_response({"message": "404"}, status=404)
        except Http404:
            return json_response({"message": "404"}, status=404)
        except Exception as exc:  # pragma: no cover
            logger.exception("Unhandled API error")
            return json_response({"message": str(exc)}, status=500)

    return wrapped


@api_view
def get_state(request):
    state = runtime.get_app_state(request)
    return json_response(
        {
            "mode": state.mode,
            "project_name": runtime.get_project_name(state.current_project_root),
        }
    )


@api_view
def list_projects(request):
    state = runtime.get_app_state(request)
    return json_response(projects.list_projects(state))


@api_view
def create_project(request):
    payload = parse_json_body(request)
    state = runtime.get_app_state(request)
    projects.create_project(state, payload.get("name", ""))
    return json_response({"status": "ok"})


@api_view
def open_project(request):
    payload = parse_json_body(request)
    runtime.open_project(request, payload.get("name", ""))
    return json_response({"status": "ok"})


@api_view
def close_project(request):
    runtime.close_project(request)
    return json_response({"status": "ok"})


@api_view
def system_check(request):
    state = runtime.get_app_state(request)
    return json_response(system_ops.check_system(state.base_dir))


@api_view
def system_open(request):
    payload = parse_json_body(request)
    state = runtime.get_app_state(request, require_workspace=True)
    system_ops.open_path(state.current_project_root, payload.get("path", ""))
    return json_response({"status": "ok"})


@api_view
def client_log(request):
    payload = parse_json_body(request)
    prefix = "[CLIENT ERROR]" if payload.get("level") == "error" else "[CLIENT]"
    logger.info("%s [%s] %s", prefix, payload.get("os", "unknown"), payload.get("message", ""))
    if payload.get("stack"):
        logger.info("%s Stack trace:\n%s", prefix, payload["stack"])
    return json_response({"status": "ok"})


@api_view
def git_log(request):
    state = runtime.get_app_state(request, require_workspace=True)
    return json_response(git_ops.get_git_log(state.current_project_root, request.GET.get("limit", "20"), request.GET.get("offset", "0")))


@api_view
def git_show(request):
    state = runtime.get_app_state(request, require_workspace=True)
    return json_response({"content": git_ops.get_commit_preview(state.current_project_root, request.GET.get("hash", ""))})


@api_view
def git_commit(request):
    payload = parse_json_body(request)
    state = runtime.get_app_state(request, require_workspace=True)
    git_ops.git_commit(state.current_project_root, payload.get("message", ""))
    return json_response({"status": "ok"})


@api_view
def git_amend(request):
    payload = parse_json_body(request)
    state = runtime.get_app_state(request, require_workspace=True)
    git_ops.git_amend_commit_message(state.current_project_root, payload.get("message", ""))
    return json_response({"status": "ok"})


@api_view
def git_reset(request):
    payload = parse_json_body(request)
    state = runtime.get_app_state(request, require_workspace=True)
    git_ops.git_reset(state.current_project_root, payload.get("hash", ""))
    return json_response({"status": "ok"})


@api_view
def generate_prompt(request):
    payload = parse_json_body(request)
    state = runtime.get_app_state(request, require_workspace=True)
    project_settings = settings_service.load_settings(state.current_project_root)
    prompt_service.generate_prompt(
        state.current_project_root,
        payload.get("task", ""),
        project_settings,
        base_dir=state.base_dir,
    )
    return json_response({"status": "ok"})


@api_view
def apply_changes(request):
    payload = parse_json_body(request)
    state = runtime.get_app_state(request, require_workspace=True)
    changed_files, message = xml_apply.apply_ai_response(state.current_project_root, payload.get("xml_content", ""))
    return json_response({"status": "ok", "message": message, "files": changed_files})


@api_view
def list_files(request):
    state = runtime.get_app_state(request)
    if state.mode == "dashboard":
        raise ApiError("Err", status_code=400)
    project_settings = settings_service.load_settings(state.current_project_root)
    return json_response(files.list_files(state.current_project_root, request.GET.get("path", ""), project_settings))


@api_view
def get_stats(request):
    state = runtime.get_app_state(request, require_workspace=True)
    project_settings = settings_service.load_settings(state.current_project_root)
    return json_response(files.calculate_stats(state.current_project_root, project_settings))


@api_view
def file_endpoint(request):
    state = runtime.get_app_state(request, require_workspace=True)
    if request.method == "GET":
        path = request.GET.get("path", "")
        if path == ".aicoder/prompt.md":
            content = settings_service.load_prompt_template(state.current_project_root, base_dir=state.base_dir)
        elif path.startswith(".aicoder/history/") and path.endswith(".diff"):
            commit_hash = path.removeprefix(".aicoder/history/").removesuffix(".diff")
            content = git_ops.get_commit_preview(state.current_project_root, commit_hash)
        else:
            content = files.read_file_content(state.current_project_root, path)
        return json_response({"content": content})

    if request.method == "POST":
        payload = parse_json_body(request)
        if payload.get("path", "").startswith(".aicoder/history/") and payload.get("path", "").endswith(".diff"):
            raise ApiError("History previews are read-only", status_code=400)
        files.write_file_content(state.current_project_root, payload.get("path", ""), payload.get("content", ""))
        return json_response({"status": "ok"})

    raise ApiError("Method not allowed", status_code=405)


@api_view
def settings_endpoint(request):
    state = runtime.get_app_state(request, require_workspace=True)
    if request.method == "GET":
        return json_response(settings_service.load_settings(state.current_project_root))

    if request.method == "POST":
        payload = parse_json_body(request)
        project_settings = settings_service.normalize_settings(payload, project_name=payload.get("project_name"))
        settings_service.save_settings(state.current_project_root, project_settings)
        return json_response(project_settings)

    raise ApiError("Method not allowed", status_code=405)


def frontend_app(request, asset_path=""):
    dist_dir = settings.FRONTEND_DIST_DIR
    asset_path = asset_path or ""
    requested_path = (dist_dir / asset_path).resolve()

    if asset_path and dist_dir.exists() and requested_path.is_file() and dist_dir in requested_path.parents:
        mime_type, _ = mimetypes.guess_type(requested_path.name)
        response = FileResponse(open(requested_path, "rb"), content_type=mime_type or "application/octet-stream")
        response["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response

    index_path = dist_dir / "index.html"
    if index_path.exists():
        response = FileResponse(open(index_path, "rb"), content_type="text/html; charset=utf-8")
        response["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response

    return HttpResponse(
        "Frontend build not found. Run `npm run build` in source/frontend or use the Vite dev server for shikumi.",
        content_type="text/plain; charset=utf-8",
    )
