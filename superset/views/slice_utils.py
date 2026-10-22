# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask_appbuilder.models.filters import BaseFilter
from markupsafe import Markup, escape


# Soft background / foreground pairs for viz_type pills on client list.
_VIZ_PILL_COLORS = {
    'echarts_stat_line': ('#ede7f6', '#5e35b1'),
    'echarts_stat_line_2': ('#e8eaf6', '#3949ab'),
    'line': ('#e8eaf6', '#5c6bc0'),
    'area': ('#e1f5fe', '#0277bd'),
    'markup': ('#fff3e0', '#ef6c00'),
    'bar': ('#e8f5e9', '#43a047'),
    'dist_bar': ('#f3e5f5', '#8e24aa'),
    'pivot_table': ('#efebe9', '#6d4c41'),
    'table': ('#eceff1', '#546e7a'),
    'pie': ('#fce4ec', '#d81b60'),
    'big_number': ('#e0f2f1', '#00897b'),
    'big_number_total': ('#e0f2f1', '#00695c'),
    'filter_box': ('#fff8e1', '#f9a825'),
    'filter_box_min': ('#fff8e1', '#f57f17'),
}

_PILL_PALETTE = [
    ('#ede7f6', '#5e35b1'),
    ('#e3f2fd', '#1565c0'),
    ('#e8f5e9', '#2e7d32'),
    ('#fff3e0', '#e65100'),
    ('#e0f7fa', '#00838f'),
    ('#fce4ec', '#c2185b'),
    ('#f3e5f5', '#7b1fa2'),
    ('#eceff1', '#455a64'),
]


def _viz_type_pill_colors(viz_type):
    if viz_type in _VIZ_PILL_COLORS:
        return _VIZ_PILL_COLORS[viz_type]
    index = sum(ord(ch) for ch in viz_type) % len(_PILL_PALETTE)
    return _PILL_PALETTE[index]


def format_viz_type_pill(value):
    """Render viz_type as a colored pill for the client chart list."""
    if not value:
        return ''
    viz_type = str(value)
    background, foreground = _viz_type_pill_colors(viz_type)
    return Markup(
        '<span class="slice-viz-pill" style="background-color:{bg};color:{fg}">'
        '{text}</span>'.format(
            bg=background, fg=foreground, text=escape(viz_type)))


class CurrentUserSliceOwnerFilter(BaseFilter):
    """Restrict slice selection to slices owned by the logged-in user."""

    def apply(self, query, get_current_user):
        return query.filter(self.model.owners.contains(get_current_user()))


def filter_accessible_datasources(
        datasources, security_manager, user=None):
    """Return only datasources the current user can access.

    FAB's ``can_access`` performs a permission query. Calling
    ``datasource_access`` for every datasource therefore produces several
    queries per item. Load the user's permission set once when a user is
    supplied, while retaining the per-item path for callers and lightweight
    test doubles that cannot provide the bulk permission API.
    """
    if user is None or not hasattr(security_manager, 'get_user_permissions'):
        return [
            datasource
            for datasource in datasources
            if security_manager.datasource_access(datasource)
        ]

    permissions = security_manager.get_user_permissions(user)
    if (
            ('all_database_access', 'all_database_access') in permissions or
            ('all_datasource_access', 'all_datasource_access') in permissions):
        return list(datasources)

    return [
        datasource
        for datasource in datasources
        if (
            ('database_access', datasource.database.perm) in permissions or
            ('schema_access', datasource.schema_perm) in permissions or
            ('datasource_access', datasource.perm) in permissions
        )
    ]


def resolve_datasource_info(
        datasource_id, datasource_type, form_data, valid_datasource_types):
    """Resolve and validate datasource identifiers accepted by explore."""
    datasource = form_data.get('datasource', '')
    if datasource:
        if not isinstance(datasource, str) or '__' not in datasource:
            raise ValueError('Invalid datasource selection')
        datasource_id, datasource_type = datasource.split('__', 1)

    try:
        datasource_id = int(datasource_id)
    except (TypeError, ValueError):
        raise ValueError('Invalid datasource identifier')

    if datasource_id < 1 or datasource_type not in valid_datasource_types:
        raise ValueError('Invalid datasource selection')

    return datasource_id, datasource_type
