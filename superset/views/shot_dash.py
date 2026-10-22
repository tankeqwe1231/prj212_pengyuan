# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
import time
import base64
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import WebDriverException
from PIL import Image
import platform
import io
import os
from datetime import datetime
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import MSO_VERTICAL_ANCHOR
import logging



class ScreenShotDash:
    def __init__(self):
        self.output_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'images', 'dash_shots')
        self.driver = None
        self.slide_list = []
        self.system = platform.system()
        # 创建输出文件夹
        if not os.path.exists(self.output_folder):
            os.makedirs(self.output_folder)
        # self.setup_driver()

    def setup_driver(self):
        """设置并启动Chrome浏览器"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--hide-scrollbars')
        # headless模式下--start-maximized无效，明确设置窗口大小
        chrome_options.add_argument('--window-size=1920,1080')
        if self.system == 'Linux':
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument('--disable-dev-shm-usage')
            # Ubuntu 服务器上的 Chrome for Testing
            chrome_options.binary_location = '/opt/chrome-for-testing/chrome'
            # Ubuntu 服务器上的 ChromeDriver
            service = Service('/usr/local/bin/chromedriver')
            self.driver = webdriver.Chrome( service=service, options=chrome_options )
        elif self.system == 'Windows':
            self.driver = webdriver.Chrome(options=chrome_options)
        else:
            raise RuntimeError(f'不支持的操作系统: {self.system}')

    def load_page(self, url):
        """加载页面并设置窗口大小"""
        logging.info(
            "加载页面: %s (%s)",
            url,
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        )
        self.driver.get(url)
        # 等待所有AJAX请求完成 - 基于react-grid-item元素数量 和 performance API
        timeout = 60  # 最多等待60秒
        start_time = time.time()
        grid_items_count = 0
        completed_ajax_count = 0
        logging.info(
            "开始ajax请求完成情况监控 (%s)",
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        )
        while time.time() - start_time < timeout:
            try:
                # 获取当前grid-item元素数量
                grid_items_count = len(self.driver.find_elements(By.CSS_SELECTOR, ".react-grid-item"))
                # 使用JavaScript获取已完成的XHR请求
                get_xhr_script = """
                    return window.performance.getEntriesByType('resource')
                        .filter(entry => entry.initiatorType === 'xmlhttprequest').length;
                """
                completed_ajax_count = self.driver.execute_script(get_xhr_script)
                print(f"当前已完成AJAX请求数: {completed_ajax_count}, grid-item元素数: {grid_items_count}")
                # 如果AJAX请求数大于等于元素数，认为页面已完全加载
                if completed_ajax_count >= grid_items_count > 0:
                    logging.info("AJAX请求数量已满足条件，页面加载完成")
                    break
                # 短暂等待后再次检查
                time.sleep(1)
            except Exception as e:
                print(f"监控网络请求时出错: {e}")
                # 如果发生错误，可能需要不同的等待策略或增加等待时间
                time.sleep(1)  # 发生错误时等待更久一点

        logging.info(
            "网络监控结束，已完成AJAX请求数: %s，grid-item元素数: %s (%s)",
            completed_ajax_count,
            grid_items_count,
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        )

        # 页面内容通常在异步请求完成后才确定尺寸。窗口宽度需要先调整，
        # 以保持 dashboard 的响应式布局；截图本身使用 CDP 整页截图，
        # 不受 headless Chrome 可视区域高度限制。
        # 有了'captureBeyondViewport': True，窗口调整可以省略
        # page_width, page_height = self._get_page_dimensions()
        # page_height += 20  # 增加额外高度以防万一
        # self.driver.set_window_size(page_width, page_height)
        # logging.info("设置窗口大小为: %sx%s", page_width, page_height)
        # time.sleep(2)  # 等待窗口调整生效

    def _get_page_dimensions(self):
        """Return the rendered dashboard dimensions in CSS pixels."""
        dimensions = self.driver.execute_script(
            """
            const body = document.body;
            const documentElement = document.documentElement;
            const scrollingElement = document.scrollingElement;
            const dashboard = document.getElementById('dashboard-container');
            const grid = document.getElementById('grid-container');
            return {
                width: Math.max(
                    body ? body.scrollWidth : 0,
                    documentElement ? documentElement.scrollWidth : 0,
                    scrollingElement ? scrollingElement.scrollWidth : 0,
                    dashboard ? dashboard.scrollWidth : 0,
                    documentElement ? documentElement.clientWidth : 0,
                    grid ? grid.scrollWidth : 0,
                ),
                height: Math.max(
                    body ? body.scrollHeight : 0,
                    documentElement ? documentElement.scrollHeight : 0,
                    scrollingElement ? scrollingElement.scrollHeight : 0,
                    dashboard ? dashboard.scrollHeight : 0,
                    documentElement ? documentElement.clientHeight : 0,
                    grid ? grid.scrollHeight : 0,
                ),
            };
            """
        )
        return max(1, int(dimensions['width'])), max(1, int(dimensions['height']))

    def _capture_page_screenshot(self, page_width, page_height):
        """Capture the complete page, including content below the viewport.

        Selenium's regular screenshot command captures only the current viewport
        in headless Chrome. Page.captureScreenshot supports ``captureBeyondViewport``
        and therefore keeps the existing implementation working for dashboards
        that have a vertical scrollbar.
        """
        try:
            response = self.driver.execute_cdp_cmd(
                'Page.captureScreenshot',
                {
                    'format': 'png',
                    'fromSurface': True,
                    'captureBeyondViewport': True,
                    'clip': {
                        'x': 0,
                        'y': 0,
                        'width': page_width,
                        'height': page_height,
                        'scale': 1,
                    },
                },
            )
            return base64.b64decode(response['data'])
        except (AttributeError, KeyError, TypeError, ValueError, WebDriverException) as error:
            # Keep compatibility with non-Chrome WebDriver implementations.
            logging.warning(
                "无法使用 Chrome 整页截图接口，回退到当前可视区域截图: %s",
                error,
            )
            return self.driver.get_screenshot_as_png()

    def capture_full_screenshot(self, url, filename):
        logging.info(
            "开始捕获全屏截图 (%s)",
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        )
        self.load_page(url)
        self.driver.execute_script('window.scrollTo(0, 0);')
        page_width, page_height = self._get_page_dimensions()
        # 查找所有react-grid-item元素
        all_grid_items = self.driver.find_elements(By.CSS_SELECTOR, ".react-grid-item")
        # 计算包含所有元素的边界框
        min_x = float('inf')
        min_y = float('inf')
        max_right = 0
        max_bottom = page_height

        # 对组内的每个元素获取位置信息
        for element in all_grid_items:
            rect = self.driver.execute_script("""
                var rect = arguments[0].getBoundingClientRect();
                return {
                    'x': rect.left + window.pageXOffset,
                    'y': rect.top + window.pageYOffset,
                    'width': rect.width,
                    'height': rect.height
                };
            """, element)

            min_x = min(min_x, rect['x'])
            min_y = min(min_y, rect['y'])
            max_right = max(max_right, rect['x'] + rect['width'])
            max_bottom = max(max_bottom, rect['y'] + rect['height'])

        if not all_grid_items:
            min_x = 0
            min_y = 0
            max_right = page_width
        # 获取设备像素比例
        pixel_ratio = self.driver.execute_script('return window.devicePixelRatio;')
        # 获取屏幕截图
        screenshot = self._capture_page_screenshot(page_width, max_bottom)
        image = Image.open(io.BytesIO(screenshot))
        # 计算裁剪区域，考虑设备像素比
        crop_left = round(min_x * pixel_ratio)
        crop_top = round(min_y * pixel_ratio)
        crop_right = round(max_right * pixel_ratio)
        crop_bottom = round(max_bottom * pixel_ratio)
        # 确保裁剪区域有效
        if crop_left < 0:
            crop_left = 0
        if crop_top < 0:
            crop_top = 0
        if crop_right > image.width:
            crop_right = image.width
        if crop_bottom > image.height:
            crop_bottom = image.height
        if crop_right <= crop_left or crop_bottom <= crop_top:
            raise RuntimeError("dashboard截图区域无效")
        # 裁剪并返回图片
        image = image.crop((crop_left, crop_top, crop_right, crop_bottom))
        image.save(os.path.join(self.output_folder, filename))
