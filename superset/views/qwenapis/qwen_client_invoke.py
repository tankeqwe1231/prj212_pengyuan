# -*- coding: utf-8 -*-
"""
通义千问 API 调用测试代码

使用示例和测试用例
"""
from qwen_http_client import QwenHttpClient


# ============================================
# 配置区域 - 请替换为您的API密钥
# ============================================
API_KEY = "sk-8ca241a875984969ab66a6977e44d64b"  # 替换为您的千问API密钥


def test_basic_chat():
    """
    测试基本对话功能
    """
    print("=" * 50)
    print("测试1: 基本对话补全")
    print("=" * 50)
    
    client = QwenHttpClient(api_key=API_KEY)
    
    messages = [
        {"role": "system", "content": "你是一个有帮助的助手。"},
        {"role": "user", "content": "你好，请介绍一下你自己。"}
    ]
    
    try:
        response = client.chat_completion(
            messages=messages,
            model="qwen-max",
            temperature=0.7
        )
        
        content = client.extract_content_from_response(response)
        print(f"回复: {content}")
        print(f"\n完整响应: {response}")
        
    except Exception as e:
        print(f"错误: {e}")


def test_streaming_chat():
    """
    测试流式对话功能
    """
    print("\n" + "=" * 50)
    print("测试2: 流式对话补全")
    print("=" * 50)
    
    client = QwenHttpClient(api_key=API_KEY)
    
    messages = [
        {"role": "user", "content": "请用100字介绍一下人工智能的发展历程。"}
    ]
    
    try:
        response = client.chat_completion(
            messages=messages,
            model="qwen-turbo",
            stream=True
        )
        
        print("流式回复: ", end="", flush=True)
        full_content = ""
        for chunk in client.parse_sse_response(response):
            content = client.extract_content_from_stream_chunk(chunk)
            if content:
                print(content, end="", flush=True)
                full_content += content
        
        print(f"\n\n完整内容长度: {len(full_content)} 字符")
        
    except Exception as e:
        print(f"错误: {e}")


def test_image_multimodal():
    """
    测试多模态图片理解功能
    """
    print("\n" + "=" * 50)
    print("测试3: 多模态图片理解")
    print("=" * 50)
    
    client = QwenHttpClient(api_key=API_KEY)
    
    # 使用帮助方法构建内容
    content_items = [
        client.build_image_content("https://dashscope.oss-cn-beijing.aliyuncs.com/images/dog_and_girl.jpeg"),
        client.build_text_content("这张图片中有什么？请详细描述。")
    ]
    
    try:
        response = client.chat_completion_multimodal(
            content_items=content_items,
            model="qwen-vl-plus",
            temperature=0.7
        )
        
        content = client.extract_content_from_response(response)
        print(f"图片描述: {content}")
        
    except Exception as e:
        print(f"错误: {e}")


def test_video_multimodal():
    """
    测试多模态视频理解功能
    """
    print("\n" + "=" * 50)
    print("测试4: 多模态视频理解")
    print("=" * 50)
    
    client = QwenHttpClient(api_key=API_KEY)
    
    # 使用帮助方法构建内容
    content_items = [
        client.build_video_content(
            "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241115/cqqkru/1.mp4",
            fps=2
        ),
        client.build_text_content("这段视频的内容是什么？")
    ]
    
    try:
        response = client.chat_completion_multimodal(
            content_items=content_items,
            model="qwen3-vl-plus",  # 使用支持视频的VL模型
            temperature=0.7
        )
        
        content = client.extract_content_from_response(response)
        print(f"视频描述: {content}")
        
    except Exception as e:
        print(f"错误: {e}")


def test_multimodal_raw_format():
    """
    测试多模态 - 使用原始格式构建内容
    """
    print("\n" + "=" * 50)
    print("测试5: 多模态 - 原始格式")
    print("=" * 50)
    
    client = QwenHttpClient(api_key=API_KEY)
    
    # 直接使用原始格式（不使用帮助方法）
    content_items = [
        {
            "type": "image_url",
            "image_url": {
                "url": "https://dashscope.oss-cn-beijing.aliyuncs.com/images/dog_and_girl.jpeg"
            }
        },
        {
            "type": "text",
            "text": "图片中的人物在做什么？"
        }
    ]
    
    try:
        response = client.chat_completion_multimodal(
            content_items=content_items,
            model="qwen-vl-plus",
            system_prompt="你是一个专业的图像分析助手，请详细描述图片内容。"
        )
        
        content = client.extract_content_from_response(response)
        print(f"回复: {content}")
        
    except Exception as e:
        print(f"错误: {e}")


def test_multi_turn_conversation():
    """
    测试多轮对话功能
    """
    print("\n" + "=" * 50)
    print("测试6: 多轮对话")
    print("=" * 50)
    
    client = QwenHttpClient(api_key=API_KEY)
    
    # 模拟多轮对话
    messages = [
        {"role": "system", "content": "你是一个知识渊博的助手。"},
        {"role": "user", "content": "什么是机器学习？"},
        {"role": "assistant", "content": "机器学习是人工智能的一个分支，它使计算机系统能够从数据中学习和改进，而无需进行明确的编程。"},
        {"role": "user", "content": "它和深度学习有什么区别？"}
    ]
    
    try:
        response = client.chat_completion(
            messages=messages,
            model="qwen-max",
            temperature=0.7
        )
        
        content = client.extract_content_from_response(response)
        print(f"回复: {content}")
        
    except Exception as e:
        print(f"错误: {e}")


def test_streaming_multimodal():
    """
    测试流式多模态对话
    """
    print("\n" + "=" * 50)
    print("测试7: 流式多模态对话")
    print("=" * 50)
    
    client = QwenHttpClient(api_key=API_KEY)
    
    content_items = [
        client.build_image_content("https://dashscope.oss-cn-beijing.aliyuncs.com/images/dog_and_girl.jpeg"),
        client.build_text_content("请用诗意的语言描述这张图片。")
    ]
    
    try:
        response = client.chat_completion_multimodal(
            content_items=content_items,
            model="qwen-vl-plus",
            stream=True
        )
        
        print("流式回复: ", end="", flush=True)
        for chunk in client.parse_sse_response(response):
            content = client.extract_content_from_stream_chunk(chunk)
            if content:
                print(content, end="", flush=True)
        print()
        
    except Exception as e:
        print(f"错误: {e}")


if __name__ == "__main__":
    print("通义千问 API 调用测试")
    print("请确保已设置正确的 API_KEY\n")
    
    # 运行所有测试
    test_basic_chat()
    # test_streaming_chat()
    # test_image_multimodal()
    # test_video_multimodal()
    # test_multimodal_raw_format()
    # test_multi_turn_conversation()
    # test_streaming_multimodal()
    
    print("\n" + "=" * 50)
    print("所有测试完成")
    print("=" * 50)
