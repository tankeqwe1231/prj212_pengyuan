import base64
import importlib.util
import io
import unittest
from pathlib import Path

from PIL import Image
from selenium.common.exceptions import WebDriverException


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'views' / 'shot_dash.py'
SPEC = importlib.util.spec_from_file_location('shot_dash', MODULE_PATH)
SHOT_DASH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SHOT_DASH)


class FakeDriver:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error
        self.calls = []

    def execute_cdp_cmd(self, command, params):
        self.calls.append((command, params))
        if self.error:
            raise self.error
        return {'data': self.payload}


class ScreenShotDashTest(unittest.TestCase):

    def _screen_shot_dash(self, driver):
        screen_shot_dash = SHOT_DASH.ScreenShotDash.__new__(SHOT_DASH.ScreenShotDash)
        screen_shot_dash.driver = driver
        return screen_shot_dash

    def test_capture_uses_cdp_beyond_viewport(self):
        image = Image.new('RGB', (100, 200), 'red')
        stream = io.BytesIO()
        image.save(stream, format='PNG')
        driver = FakeDriver(base64.b64encode(stream.getvalue()).decode('ascii'))

        result = self._screen_shot_dash(driver)._capture_page_screenshot(100, 200)

        self.assertEqual(Image.open(io.BytesIO(result)).size, (100, 200))
        command, params = driver.calls[0]
        self.assertEqual(command, 'Page.captureScreenshot')
        self.assertTrue(params['captureBeyondViewport'])
        self.assertEqual(params['clip']['height'], 200)

    def test_capture_falls_back_when_cdp_is_unavailable(self):
        fallback = b'viewport screenshot'
        driver = FakeDriver(error=WebDriverException('unsupported'))
        driver.get_screenshot_as_png = lambda: fallback

        with self.assertLogs(level='WARNING'):
            result = self._screen_shot_dash(driver)._capture_page_screenshot(100, 200)

        self.assertEqual(result, fallback)


if __name__ == '__main__':
    unittest.main()
