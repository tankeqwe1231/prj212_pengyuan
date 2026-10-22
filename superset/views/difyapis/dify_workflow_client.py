import requests
import json
from typing import Dict, Optional, List, Generator, Any
from superset import (app)

# 设置 dify 基础 URL, dify api 不同应用的api key不一样，所以需要设置不同的api key
config = app.config


class DifyWorkFlowClient:
    """
    Dify 工作流型应用 API客户端类，用于与Dify 工作流型应用 API进行交互
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

    def run_workflow(self,
                     inputs: Dict,
                     user: str,
                     response_mode: str = "streaming",
                     files: Optional[List[Dict]] = None,
                     trace_id: Optional[str] = None) -> Any:
        """
        执行 workflow
        
        Args:
            inputs (Dict): 允许传入 App 定义的各变量值
            user (str): 用户标识，用于定义终端用户的身份
            response_mode (str): 返回响应模式，支持 "streaming" 或 "blocking"
            files (List[Dict], optional): 文件列表
            trace_id (str, optional): 链路追踪ID
            
        Returns:
            如果是 blocking 模式，返回完整响应字典
            如果是 streaming 模式，返回 Response 对象用于流式处理
            
        Raises:
            ValueError: 参数错误
            requests.RequestException: 网络请求错误
        """
        if response_mode not in ["streaming", "blocking"]:
            raise ValueError("response_mode 必须是 'streaming' 或 'blocking'")

        data = {
            "inputs": inputs,
            "response_mode": response_mode,
            "user": user
        }

        if files:
            data["files"] = files

        if trace_id:
            data["trace_id"] = trace_id

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        if trace_id:
            headers["X-Trace-Id"] = trace_id

        url = f"{self.api_url}/workflows/run"

        try:
            if response_mode == "streaming":
                response = requests.post(
                    url,
                    json=data,
                    headers=headers,
                    stream=True,
                    timeout=300  # 5分钟超时
                )
                response.raise_for_status()
                return response
            else:
                response = requests.post(
                    url,
                    json=data,
                    headers=headers,
                    timeout=100  # blocking 模式 100秒超时
                )
                response.raise_for_status()
                raw_data = response.json()
                return self.parse_blocking_response(raw_data)

        except requests.exceptions.RequestException as e:
            raise requests.RequestException(f"Workflow 执行请求失败: {str(e)}")

    def parse_blocking_response(self, response_data: Dict) -> Dict:
        """
        解析 blocking 模式的 CompletionResponse 响应
        
        Args:
            response_data (Dict): 从 API 返回的原始 JSON 数据
            
        Returns:
            Dict: 格式化后的响应数据
            
        Raises:
            ValueError: 响应数据格式错误
        """
        try:
            workflow_run_id = response_data.get("workflow_run_id")
            task_id = response_data.get("task_id")
            data = response_data.get("data", {})

            if not workflow_run_id:
                raise ValueError("响应中缺少 workflow_run_id 字段")

            if not task_id:
                raise ValueError("响应中缺少 task_id 字段")

            workflow_id = data.get("workflow_id")
            status = data.get("status")
            outputs = data.get("outputs")
            error = data.get("error")
            elapsed_time = data.get("elapsed_time")
            total_tokens = data.get("total_tokens")
            total_steps = data.get("total_steps", 0)
            created_at = data.get("created_at")
            finished_at = data.get("finished_at")

            parsed_response = {
                "workflow_run_id": workflow_run_id,
                "task_id": task_id,
                "workflow_id": workflow_id,
                "status": status,
                "outputs": outputs,
                "error": error,
                "elapsed_time": elapsed_time,
                "total_tokens": total_tokens,
                "total_steps": total_steps,
                "created_at": created_at,
                "finished_at": finished_at
            }

            if status == "succeeded":
                parsed_response["message"] = "工作流执行成功"
            elif status == "failed":
                parsed_response["message"] = f"工作流执行失败: {error or '未知错误'}"
            elif status == "stopped":
                parsed_response["message"] = "工作流执行被停止"
            else:
                parsed_response["message"] = f"工作流状态: {status}"

            return parsed_response

        except KeyError as e:
            raise ValueError(f"响应数据格式错误，缺少字段: {str(e)}")
        except Exception as e:
            raise ValueError(f"解析 blocking 响应时出错: {str(e)}")

    def parse_sse_response(self, response: requests.Response) -> Generator[Dict, None, None]:
        """
        解析 SSE 流式响应
        
        Args:
            response: requests.Response 对象
            
        Yields:
            Dict: 解析后的事件数据
        """
        try:
            for line in response.iter_lines(decode_unicode=True):
                if line:
                    # SSE 格式：data: {...}
                    if line.startswith('data: '):
                        data_str = line[6:]  # 去掉 'data: ' 前缀
                        try:
                            event_data = json.loads(data_str)
                            yield event_data
                        except json.JSONDecodeError:
                            # 忽略无法解析的行
                            continue
                    elif line.strip() == '':
                        # 空行，事件分隔符
                        continue

        except Exception as e:
            yield {
                "event": "error",
                "error": f"解析 SSE 响应时出错: {str(e)}"
            }

    def handle_workflow_events(self, response: requests.Response) -> Generator[Dict, None, None]:
        """
        处理 workflow 流式事件
        
        Args:
            response: requests.Response 对象
            
        Yields:
            Dict: 处理后的事件数据，包含事件类型和相关信息
        """
        for event in self.parse_sse_response(response):
            event_type = event.get("event", "unknown")

            if event_type == "workflow_started":
                yield {
                    "type": "workflow_started",
                    "workflow_run_id": event.get("workflow_run_id"),
                    "task_id": event.get("task_id"),
                    "data": event.get("data", {})
                }

            elif event_type == "node_started":
                yield {
                    "type": "node_started",
                    "workflow_run_id": event.get("workflow_run_id"),
                    "task_id": event.get("task_id"),
                    "data": event.get("data", {})
                }

            elif event_type == "text_chunk":
                yield {
                    "type": "text_chunk",
                    "workflow_run_id": event.get("workflow_run_id"),
                    "task_id": event.get("task_id"),
                    "text": event.get("data", {}).get("text", ""),
                    "from_variable_selector": event.get("data", {}).get("from_variable_selector", [])
                }

            elif event_type == "node_finished":
                yield {
                    "type": "node_finished",
                    "workflow_run_id": event.get("workflow_run_id"),
                    "task_id": event.get("task_id"),
                    "data": event.get("data", {})
                }

            elif event_type == "workflow_finished":
                yield {
                    "type": "workflow_finished",
                    "workflow_run_id": event.get("workflow_run_id"),
                    "task_id": event.get("task_id"),
                    "data": event.get("data", {})
                }

            elif event_type == "tts_message":
                yield {
                    "type": "tts_message",
                    "task_id": event.get("task_id"),
                    "message_id": event.get("message_id"),
                    "audio": event.get("audio", ""),
                    "created_at": event.get("created_at")
                }

            elif event_type == "tts_message_end":
                yield {
                    "type": "tts_message_end",
                    "task_id": event.get("task_id"),
                    "message_id": event.get("message_id"),
                    "created_at": event.get("created_at")
                }

            elif event_type == "ping":
                yield {
                    "type": "ping",
                    "message": "连接保持活跃"
                }

            elif event_type == "error":
                yield {
                    "type": "error",
                    "error": event.get("error", "未知错误")
                }

            else:
                # 未知事件类型，原样返回
                yield {
                    "type": "unknown",
                    "raw_event": event
                }
    
    def upload_file(self, file_path: str, user: str = "default_user") -> Dict:
        """
        上传文件，用于在执行工作流时引用
        
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
    
    def stop_workflow(self, task_id: str, user: str = "default_user") -> Dict:
        """
        停止正在运行的工作流任务，仅在流式模式下有效
        
        Args:
            task_id: 任务ID，可从流式响应的返回块中获取
            user: 用户标识，需要与执行工作流时的用户标识一致
            
        Returns:
            dict: 停止结果，成功返回 {"result": "success"}
        """
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        data = {"user": user}
        
        response = requests.post(
            f"{self.api_url}/workflows/tasks/{task_id}/stop",
            headers=headers,
            json=data
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"停止工作流失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_workflow_run_detail(self, workflow_run_id: str) -> Dict:
        """
        获取工作流执行详情
        
        Args:
            workflow_run_id: 工作流运行ID，可从流式响应或 blocking 响应中获取
            
        Returns:
            dict: 工作流执行详情，包含:
                - id: 工作流执行ID
                - workflow_id: 关联的工作流ID
                - status: 执行状态 (running, succeeded, failed, stopped)
                - inputs: 输入内容
                - outputs: 输出内容
                - error: 错误原因（如果失败）
                - total_steps: 总步数
                - total_tokens: 总使用tokens
                - created_at: 开始时间
                - finished_at: 结束时间
                - elapsed_time: 耗时（秒）
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        
        response = requests.get(
            f"{self.api_url}/workflows/run/{workflow_run_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"获取工作流详情失败: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_workflow_logs(self, keyword: str = None, status: str = None, 
                          page: int = 1, limit: int = 20) -> Dict:
        """
        获取工作流执行日志列表
        
        Args:
            keyword: 关键词搜索（可选）
            status: 筛选执行状态（可选）: succeeded, failed, stopped, running
            page: 页码，默认1
            limit: 每页数量，默认20
            
        Returns:
            dict: 工作流日志列表，包含:
                - page: 当前页码
                - limit: 每页数量
                - total: 总数
                - has_more: 是否有更多
                - data: 日志列表
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }
        params = {
            'page': page,
            'limit': limit
        }
        
        if keyword:
            params['keyword'] = keyword
        if status:
            params['status'] = status
        
        response = requests.get(
            f"{self.api_url}/workflows/logs",
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"获取工作流日志失败: {response.status_code} - {response.text}")
        
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
        获取应用参数配置
        
        Args:
            user: 用户标识
            
        Returns:
            dict: 应用参数配置，包含:
                - user_input_form: 用户输入表单配置
                - file_upload: 文件上传配置
                - system_parameters: 系统参数（如文件大小限制等）
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
    
    def text_to_audio(self, text: str = None, message_id: str = None, 
                      user: str = "default_user", streaming: bool = False):
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