from html.parser import HTMLParser
from pathlib import Path
import unittest

from jinja2 import DictLoader, Environment, select_autoescape


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = (
    REPOSITORY_ROOT
    / 'superset'
    / 'templates'
    / 'appbuilder'
    / 'general'
    / 'lib.html'
)


class PaginationLinkParser(HTMLParser):

    def __init__(self):
        super().__init__()
        self.links = []
        self._current_link = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and 'page-link' in attrs.get('class', '').split():
            self._current_link = {
                'href': attrs.get('href'),
                'aria_label': attrs.get('aria-label'),
                'text': '',
            }

    def handle_data(self, data):
        if self._current_link is not None:
            self._current_link['text'] += data

    def handle_endtag(self, tag):
        if tag == 'a' and self._current_link is not None:
            self._current_link['text'] = self._current_link['text'].strip()
            self.links.append(self._current_link)
            self._current_link = None


class FabPaginationTemplateTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        environment = Environment(
            loader=DictLoader({
                'appbuilder/general/lib.html': TEMPLATE_PATH.read_text(
                    encoding='utf-8'
                ),
                'appbuilder/baselib.html': (
                    '{% macro get_nonce() %}{% endmacro %}'
                ),
            }),
            autoescape=select_autoescape(('html',)),
        )
        environment.globals['_'] = lambda value: value
        environment.filters.update({
            'get_actions_on_show': lambda value, modelview_name: value,
            'get_link_order': lambda value, modelview_name: value,
            'link_order': lambda value, modelview_name: value,
            'link_page': lambda page, modelview_name: (
                '/list/?page_{}={}'.format(modelview_name, page)
            ),
            'link_page_size': lambda value, modelview_name: value,
            'safe_url_for': lambda value, **kwargs: value,
            'set_link_filters': lambda value, filters: value,
        })
        cls.pagination = environment.get_template(
            'appbuilder/general/lib.html'
        ).module.render_pagination

    def render_links(self, page):
        parser = PaginationLinkParser()
        parser.feed(str(self.pagination(page, 25, 250, 'SliceModelView')))
        return parser.links

    def test_first_and_last_page_links_target_page_boundaries(self):
        links = self.render_links(4)

        self.assertEqual('<<', links[0]['text'])
        self.assertEqual('First page', links[0]['aria_label'])
        self.assertEqual('/list/?page_SliceModelView=0', links[0]['href'])
        self.assertEqual('>>', links[-1]['text'])
        self.assertEqual('Last page', links[-1]['aria_label'])
        self.assertEqual('/list/?page_SliceModelView=9', links[-1]['href'])

    def test_boundary_links_are_disabled_on_first_and_last_pages(self):
        first_page_links = self.render_links(0)
        last_page_links = self.render_links(9)

        self.assertEqual('#', first_page_links[0]['href'])
        self.assertEqual('#', last_page_links[-1]['href'])


if __name__ == '__main__':
    unittest.main()
