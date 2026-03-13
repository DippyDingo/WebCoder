from django.contrib import admin
from django.urls import include, path, re_path

from api import views as api_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    re_path(r"^(?P<asset_path>.*)$", api_views.frontend_app, name="frontend-app"),
]
