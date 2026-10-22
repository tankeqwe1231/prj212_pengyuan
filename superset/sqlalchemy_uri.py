# -*- coding: utf-8 -*-
"""Compatibility helpers for SQLAlchemy connection URIs."""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals


def normalize_sqlalchemy_uri(uri):
    """Percent-encode raw ``@`` characters inside URI user information.

    SQLAlchemy treats the final ``@`` in an authority as the separator before
    the host. Any earlier ``@`` belongs to the username or password and must be
    percent-encoded before SQLAlchemy parses the URI.
    """
    authority_marker = '://'
    marker_index = uri.find(authority_marker)
    if marker_index == -1:
        return uri

    authority_start = marker_index + len(authority_marker)
    authority_end = len(uri)
    for separator in '/?#':
        separator_index = uri.find(separator, authority_start)
        if separator_index != -1:
            authority_end = min(authority_end, separator_index)

    host_separator = uri.rfind('@', authority_start, authority_end)
    if host_separator == -1:
        return uri

    user_information = uri[authority_start:host_separator]
    if '@' not in user_information:
        return uri

    normalized_user_information = user_information.replace('@', '%40')
    return ''.join((
        uri[:authority_start],
        normalized_user_information,
        uri[host_separator:],
    ))
