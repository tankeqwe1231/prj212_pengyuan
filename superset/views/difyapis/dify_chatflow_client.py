import requests
import json
from typing import Dict
from superset import (app)


# 设置 dify 基础 URL, dify api 不同应用的api key不一样，所以需要设置不同的api key
config = app.config

class DifyChatFlowClient:
    """
    Dify 对话型应用 API客户端类，用于与Dify 对话型应用 API进行交互
    """
    
    def __init__(self, api_key=None):
        """
        初始化Dify客户端
        
        Args:
            api_key (str, optional): Dify API密钥
        """
        self.api_key = api_key
        self.api_url = config.get('DIFY_API_URL')
        
        if not self.api_key:
            raise ValueError("Dify API密钥未配置")
    
    def send_chat_message(self, query, inputs=None, conversation_id=None, user="test-user", 
                          response_mode="streaming", files=None, auto_generate_name=True):
        """
        发送聊天消息到Dify API
        
        Args:
            query (str): 用户查询内容
            inputs (dict, optional): 允许传入 App 定义的各变量值，inputs 参数包含了多组键值对，
                每组的键对应一个特定变量，每组的值则是该变量的具体值。
                默认 {}
            conversation_id (str, optional): 会话ID，用于继续之前的对话。
                首次对话时不传，后续对话必须传入已存在的会话ID
            user (str, optional): 用户标识，用于定义终端用户的身份，默认为"test-user"
            response_mode (str, optional): 响应模式:
                - "streaming": 流式模式，基于SSE实时返回（推荐）
                - "blocking": 阻塞模式，等待执行完毕后返回
            files (list, optional): 文件列表，适用于传入文件（图片）结合文本理解并回答问题。
                仅当模型支持视觉能力时可用。每个文件对象格式：
                {
                    "type": "image",  # 支持类型: document, image, audio, video, custom
                    "transfer_method": "remote_url" 或 "local_file",
                    "url": "图片URL",  # transfer_method 为 remote_url 时使用
                    "upload_file_id": "文件ID"  # transfer_method 为 local_file 时使用
                }
            auto_generate_name (bool, optional): 自动生成会话标题，默认 True。
                若设置为 False，则可通过 rename_conversation 方法自行设置会话标题
            
        Returns:
            requests.Response: 如果response_mode为"streaming"，返回流式响应对象
            dict: 如果response_mode为"blocking"，返回解析后的JSON响应
            
        Raises:
            ValueError: 如果查询内容为空
            requests.RequestException: 如果API请求失败
        """
        if not query:
            raise ValueError("查询内容不能为空")
        
        request_body = {
            "inputs": inputs if inputs else {},
            "query": query,
            "response_mode": response_mode,
            "user": user,
            "auto_generate_name": auto_generate_name
        }
        
        if conversation_id:
            request_body["conversation_id"] = conversation_id
        
        if files:
            request_body["files"] = files
        
        # 设置请求头
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        
        endpoint = f"{self.api_url}/chat-messages"
        
        if response_mode == "streaming":
            response = requests.post(
                endpoint,
                json=request_body,
                headers=headers,
                stream=True
            )
        else:
            response = requests.post(
                endpoint,
                json=request_body,
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
        
        if response.status_code != 200:
            error_msg = f"Dify API请求失败: {response.status_code}"
            try:
                error_data = response.json()
                if "error" in error_data:
                    error_msg += f" - {error_data['error']}"
            except:
                if response_mode != "streaming":
                    error_msg += f" - {response.text}"
            
            raise requests.RequestException(error_msg)
        
        return response
    
    def get_conversations(self, user="test-user", limit=20, last_id=None, sort_by="-updated_at", pinned=None):
        """
        获取用户的会话列表
        
        Args:
            user (str, optional): 用户标识，默认为"test-user"
            limit (int, optional): 返回的最大会话数量，默认20，范围1-100
            last_id (str, optional): 当前页最后一条记录的ID，用于分页
            sort_by (str, optional): 排序字段，默认 -updated_at（按更新时间倒序）
                可选值: created_at, -created_at, updated_at, -updated_at
            pinned (bool, optional): 只返回置顶会话（True）或只返回非置顶会话（False），不传则返回全部
            
        Returns:
            dict: 包含会话列表的JSON响应
        """
        endpoint = f"{self.api_url}/conversations"
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        params = {
            'user': user,
            'limit': limit,
            'sort_by': sort_by
        }
        
        if last_id:
            params['last_id'] = last_id
        if pinned is not None:
            params['pinned'] = pinned
        
        response = requests.get(endpoint, headers=headers, params=params)
        
        if response.status_code != 200:
            raise requests.RequestException(f"获取会话列表失败: {response.status_code}")
        
        return response.json()
    
    def get_conversation_messages(self, conversation_id, user="test-user", first=20):
        """
        获取特定会话的消息历史
        
        Args:
            conversation_id (str): 会话ID
            user (str, optional): 用户标识，默认为"test-user"
            first (int, optional): 返回的最大消息数量
            
        Returns:
            dict: 包含消息历史的JSON响应
        """
        endpoint = f"{self.api_url}/messages"
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        params = {
            'user': user,
            'conversation_id': conversation_id,
            'first': first
        }
        
        response = requests.get(endpoint, headers=headers, params=params)
        
        if response.status_code != 200:
            raise requests.RequestException(f"获取会话消息失败: {response.status_code}")
        
        return response.json()
    
    def rename_conversation(self, conversation_id, name, user="test-user"):
        """
        重命名会话
        
        Args:
            conversation_id (str): 会话ID
            name (str): 新的会话名称
            user (str, optional): 用户标识，默认为"test-user"
            
        Returns:
            dict: API响应
        """
        endpoint = f"{self.api_url}/conversations/{conversation_id}/name"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        data = {
            'name': name,
            'user': user
        }
        
        response = requests.post(endpoint, headers=headers, json=data)
        
        if response.status_code != 200:
            raise requests.RequestException(f"重命名会话失败: {response.status_code}")
        
        return response.json()
    
    def delete_conversation(self, conversation_id, user="test-user"):
        """
        删除会话
        
        Args:
            conversation_id (str): 会话ID
            user (str, optional): 用户标识，默认为"test-user"
            
        Returns:
            dict: API响应
        """
        endpoint = f"{self.api_url}/conversations/{conversation_id}"
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        params = {
            'user': user
        }
        
        response = requests.delete(endpoint, headers=headers, params=params)
        
        if response.status_code != 200:
            raise requests.RequestException(f"删除会话失败: {response.status_code}")
        
        return response.json()
    
    def pin_conversation(self, conversation_id: str, user: str = "default_user") -> Dict:
        """
        置顶会话
        
        Args:
            conversation_id: 会话ID
            user: 用户标识
            
        Returns:
            dict: API响应，成功返回 {"result": "success"}
        """
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        data = {'user': user}
        
        response = requests.patch(
            f"{self.api_url}/conversations/{conversation_id}/pin",
            headers=headers,
            json=data
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"置顶会话失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def unpin_conversation(self, conversation_id: str, user: str = "default_user") -> Dict:
        """
        取消置顶会话
        
        Args:
            conversation_id: 会话ID
            user: 用户标识
            
        Returns:
            dict: API响应，成功返回 {"result": "success"}
        """
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        data = {'user': user}
        
        response = requests.patch(
            f"{self.api_url}/conversations/{conversation_id}/unpin",
            headers=headers,
            json=data
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"取消置顶会话失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def parse_sse_response(self, response):
        """
        解析服务器发送事件(SSE)响应
        
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
                    try:
                        yield json.loads(data)
                    except json.JSONDecodeError:
                        yield {"error": f"无法解析JSON: {data}"}
    
    def upload_file(self, file_path: str, user: str = "default_user") -> Dict:
        """
        上传文件，用于在发送消息时引用
        
        Args:
            file_path: 文件路径
            user: 用户标识
            
        Returns:
            dict: 上传文件的响应信息，包含:
                - id: 文件ID
                - name: 文件名
                - size: 文件大小（字节）
                - extension: 文件扩展名
                - mime_type: 文件MIME类型
                - created_by: 创建者ID
                - created_at: 创建时间戳
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'user': user}
            response = requests.post(
                f"{self.api_url}/files/upload",
                headers=headers,
                files=files,
                data=data
            )
            
            if response.status_code != 200 and response.status_code != 201:
                raise requests.RequestException(f"文件上传失败: {response.status_code} - {response.text}")
            
            return response.json()
    
    def stop_response(self, task_id: str, user: str = "default_user") -> Dict:
        """
        停止响应，仅在流式模式下有效
        
        Args:
            task_id: 任务 ID，可从流式响应的返回块中获取
            user: 用户标识，需要与发送消息时的用户标识一致
            
        Returns:
            dict: 停止响应的结果，成功返回 {"result": "success"}
        """
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        data = {"user": user}
        response = requests.post(
            f"{self.api_url}/chat-messages/{task_id}/stop",
            headers=headers,
            json=data
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"停止响应失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def send_feedback(self, message_id: str, rating: str, user: str = "default_user", content: str = None) -> Dict:
        """
        发送消息反馈（点赞/点踩）
        
        Args:
            message_id: 消息 ID
            rating: 评价，可选值: "like"(点赞), "dislike"(点踩), 或 None(撤销评价)
            user: 用户标识，需要与发送消息时的用户标识一致
            content: 反馈的具体信息（可选）
            
        Returns:
            dict: 反馈结果，成功返回 {"result": "success"}
        """
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        data = {
            "rating": rating,
            "user": user
        }
        if content:
            data["content"] = content
            
        response = requests.post(
            f"{self.api_url}/messages/{message_id}/feedbacks",
            headers=headers,
            json=data
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"发送反馈失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_suggested_questions(self, message_id: str, user: str = "default_user") -> Dict:
        """
        获取下一轮建议问题列表
        
        Args:
            message_id: 消息 ID
            user: 用户标识
            
        Returns:
            dict: 建议问题列表，格式为 {"result": "success", "data": ["问题1", "问题2", ...]}
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        params = {"user": user}
        response = requests.get(
            f"{self.api_url}/messages/{message_id}/suggested",
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"获取建议问题失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_app_info(self) -> Dict:
        """
        获取应用基本信息，用于获取应用的基本配置
        
        Returns:
            dict: 应用信息，包含:
                - name: 应用名称
                - description: 应用描述
                - tags: 应用标签
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        response = requests.get(
            f"{self.api_url}/info",
            headers=headers
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"获取应用信息失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_parameters(self, user: str = "default_user") -> Dict:
        """
        获取应用参数配置，包括开场白、建议问题、表单等
        
        Args:
            user: 用户标识
            
        Returns:
            dict: 应用参数配置，包含:
                - opening_statement: 开场白
                - suggested_questions: 建议问题列表
                - suggested_questions_after_answer: 启用回答后的建议问题配置
                - speech_to_text: 语音转文本配置
                - retriever_resource: 引用和归属配置
                - annotation_reply: 标注回复配置
                - user_input_form: 用户输入表单配置
                - file_upload: 文件上传配置
                - system_parameters: 系统参数
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        params = {"user": user}
        response = requests.get(
            f"{self.api_url}/parameters",
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"获取应用参数失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_meta(self, user: str = "default_user") -> Dict:
        """
        获取应用Meta信息，用于获取工具图标等信息
        
        Args:
            user: 用户标识
            
        Returns:
            dict: 应用Meta信息，包含:
                - tool_icons: 工具图标信息
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        params = {"user": user}
        response = requests.get(
            f"{self.api_url}/meta",
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"获取应用Meta信息失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def text_to_audio(self, text: str = None, message_id: str = None, user: str = "default_user", streaming: bool = False):
        """
        文本转语音
        
        Args:
            text: 要转换的文本内容（与 message_id 二选一）
            message_id: Dify生成的文本消息ID，可以直接传生成的message-id即可
            user: 用户标识
            streaming: 是否返回流式响应，默认 False
            
        Returns:
            如果 streaming=False: bytes 音频数据
            如果 streaming=True: requests.Response 流式响应对象
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        data = {"user": user}
        if message_id:
            data["message_id"] = message_id
        elif text:
            data["text"] = text
        else:
            raise ValueError("必须提供 message_id 或 text 参数")
        
        if streaming:
            response = requests.post(
                f"{self.api_url}/text-to-audio",
                headers=headers,
                json=data,
                stream=True
            )
            if response.status_code != 200:
                raise requests.RequestException(f"文本转语音失败: {response.status_code}")
            return response
        else:
            response = requests.post(
                f"{self.api_url}/text-to-audio",
                headers=headers,
                json=data
            )
            if response.status_code != 200:
                raise requests.RequestException(f"文本转语音失败: {response.status_code}")
            return response.content
    
    def audio_to_text(self, audio_file_path: str, user: str = "default_user") -> Dict:
        """
        语音转文本
        
        Args:
            audio_file_path: 音频文件路径，支持格式: mp3, mp4, mpeg, mpga, m4a, wav, webm
            user: 用户标识
            
        Returns:
            dict: 转换结果，格式为 {"text": "转换后的文本内容"}
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        with open(audio_file_path, 'rb') as f:
            files = {'file': f}
            data = {'user': user}
            response = requests.post(
                f"{self.api_url}/audio-to-text",
                headers=headers,
                files=files,
                data=data
            )
            
            if response.status_code != 200:
                raise requests.RequestException(f"语音转文本失败: {response.status_code} - {response.text}")
            
            return response.json()