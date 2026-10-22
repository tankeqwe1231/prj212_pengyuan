# -*- coding: utf-8 -*-
"""
通义千问 API HTTP客户端

基于requests封装的千问API调用客户端，支持：
- 对话补全（流式/非流式）
- 多模态对话（图片/视频）
"""
import requests
import json
from typing import Dict, List, Optional, Union, Generator


class QwenHttpClient:
    """
    通义千问 API HTTP客户端类，用于与千问API进行交互
    """
    
    # 默认API基础URL
    DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    
    def __init__(self, api_key: str, base_url: str = None):
        """
        初始化千问客户端
        
        Args:
            api_key (str): 千问API密钥
            base_url (str, optional): API基础URL，默认使用阿里云DashScope兼容模式
        """
        if not api_key:
            raise ValueError("千问API密钥不能为空")
        
        self.api_key = api_key
        self.base_url = base_url or self.DEFAULT_BASE_URL
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
    
    def chat_completion(
        self,
        messages: List[Dict],
        model: str = "qwen-max",
        temperature: float = 0.7,
        top_p: float = 0.8,
        max_tokens: int = None,
        stream: bool = False,
        **kwargs
    ) -> Union[Dict, requests.Response]:
        """
        对话补全接口
        
        Args:
            messages (list): 消息列表，格式为 [{"role": "user", "content": "..."}]
            model (str): 模型名称，默认 qwen-max
                可选值: qwen-turbo, qwen-plus, qwen-max, qwen-max-longcontext 等
            temperature (float): 采样温度，默认0.7，范围0-2
            top_p (float): 核采样概率，默认0.8
            max_tokens (int, optional): 最大生成token数
            stream (bool): 是否使用流式响应，默认False
            **kwargs: 其他可选参数
            
        Returns:
            dict: 如果stream=False，返回解析后的JSON响应
            requests.Response: 如果stream=True，返回流式响应对象
            
        Raises:
            ValueError: 如果消息列表为空
            requests.RequestException: 如果API请求失败
        """
        if not messages:
            raise ValueError("消息列表不能为空")
        
        request_body = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "stream": stream,
            **kwargs
        }
        
        if max_tokens is not None:
            request_body["max_tokens"] = max_tokens
        
        endpoint = f"{self.base_url}/chat/completions"
        
        if stream:
            response = requests.post(
                endpoint,
                json=request_body,
                headers=self.headers,
                stream=True
            )
        else:
            response = requests.post(
                endpoint,
                json=request_body,
                headers=self.headers
            )
        
        if response.status_code != 200:
            error_msg = f"千问API请求失败: {response.status_code}"
            try:
                error_data = response.json()
                if "error" in error_data:
                    error_msg += f" - {error_data['error'].get('message', str(error_data['error']))}"
            except:
                error_msg += f" - {response.text}"
            raise requests.RequestException(error_msg)
        
        if stream:
            return response
        else:
            return response.json()
    
    def chat_completion_multimodal(
        self,
        content_items: List[Dict],
        model: str = "qwen-vl-plus",
        system_prompt: str = None,
        temperature: float = 0.7,
        top_p: float = 0.8,
        max_tokens: int = None,
        stream: bool = False,
        **kwargs
    ) -> Union[Dict, requests.Response]:
        """
        多模态对话补全接口，支持图片和视频输入
        
        Args:
            content_items (list): 多模态内容列表，支持以下类型：
                - 文本: {"type": "text", "text": "描述文本"}
                - 图片URL: {"type": "image_url", "image_url": {"url": "图片URL"}}
                - 视频URL: {"type": "video_url", "video_url": {"url": "视频URL"}, "fps": 2}
            model (str): 模型名称，默认 qwen-vl-plus
                可选值: qwen-vl-plus, qwen-vl-max, qwen3-vl-plus 等视觉模型
            system_prompt (str, optional): 系统提示词
            temperature (float): 采样温度，默认0.7
            top_p (float): 核采样概率，默认0.8
            max_tokens (int, optional): 最大生成token数
            stream (bool): 是否使用流式响应，默认False
            **kwargs: 其他可选参数
            
        Returns:
            dict: 如果stream=False，返回解析后的JSON响应
            requests.Response: 如果stream=True，返回流式响应对象
            
        Example:
            # 图片理解
            content = [
                {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}},
                {"type": "text", "text": "这张图片中有什么?"}
            ]
            response = client.chat_completion_multimodal(content)
            
            # 视频理解
            content = [
                {"type": "video_url", "video_url": {"url": "https://example.com/video.mp4"}, "fps": 2},
                {"type": "text", "text": "这段视频的内容是什么?"}
            ]
            response = client.chat_completion_multimodal(content, model="qwen3-vl-plus")
        """
        if not content_items:
            raise ValueError("内容列表不能为空")
        
        messages = []
        
        # 添加系统提示词
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        # 添加用户多模态消息
        messages.append({
            "role": "user",
            "content": content_items
        })
        
        return self.chat_completion(
            messages=messages,
            model=model,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            stream=stream,
            **kwargs
        )
    
    def build_image_content(self, image_url: str, detail: str = "auto") -> Dict:
        """
        构建图片内容项
        
        Args:
            image_url (str): 图片URL或base64编码
            detail (str): 图片细节级别，可选 "auto", "low", "high"
            
        Returns:
            dict: 图片内容字典
        """
        return {
            "type": "image_url",
            "image_url": {
                "url": image_url,
                "detail": detail
            }
        }
    
    def build_video_content(self, video_url: str, fps: int = 2) -> Dict:
        """
        构建视频内容项
        
        Args:
            video_url (str): 视频URL
            fps (int): 视频采样帧率，默认2帧/秒
            
        Returns:
            dict: 视频内容字典
        """
        return {
            "type": "video_url",
            "video_url": {
                "url": video_url
            },
            "fps": fps
        }
    
    def build_text_content(self, text: str) -> Dict:
        """
        构建文本内容项
        
        Args:
            text (str): 文本内容
            
        Returns:
            dict: 文本内容字典
        """
        return {
            "type": "text",
            "text": text
        }
    
    def parse_sse_response(self, response: requests.Response) -> Generator[Dict, None, None]:
        """
        解析服务器发送事件(SSE)流式响应
        
        Args:
            response (requests.Response): 流式响应对象
            
        Yields:
            dict: 解析后的事件数据
        """
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data = line[6:]  # 移除 "data: " 前缀
                    if data == '[DONE]':
                        break
                    try:
                        yield json.loads(data)
                    except json.JSONDecodeError:
                        yield {"error": f"无法解析JSON: {data}"}
    
    def extract_content_from_response(self, response: Dict) -> str:
        """
        从API响应中提取生成的内容
        
        Args:
            response (dict): API响应
            
        Returns:
            str: 生成的文本内容
        """
        try:
            return response['choices'][0]['message']['content']
        except (KeyError, IndexError):
            return ""
    
    def extract_content_from_stream_chunk(self, chunk: Dict) -> str:
        """
        从流式响应块中提取内容
        
        Args:
            chunk (dict): 流式响应块
            
        Returns:
            str: 该块中的文本内容
        """
        try:
            delta = chunk['choices'][0].get('delta', {})
            return delta.get('content', '')
        except (KeyError, IndexError):
            return ""
