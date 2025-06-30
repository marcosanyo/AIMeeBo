import json
from typing import List, Tuple, Dict, Any, Optional
import uuid  # uuid をインポート

# Vertex AI SDK
try:
    from vertexai.generative_models import GenerativeModel, Part as VertexPart
except ImportError:
    # This will be handled by VERTEX_AI_AVAILABLE from config
    pass

from models import Message
from config import logger, VERTEX_AI_AVAILABLE, VERTEX_MODEL_NAME
import os  # osモジュールをインポート

# BaseAgentのインポートパスはmain.pyの構造に依存するため、ここでは一旦コメントアウト
# from .base_agent import MeetingAgent


class AgendaManagementAgent:  # MeetingAgent): # BaseAgentを継承する場合はコメントを外す
    def __init__(self, config_path: str):
        self.config_path = config_path  # 現状は使用しないが、将来的な設定読み込みのために保持
        # 設定ファイルを使用する場合はここで読み込み処理などを追加
        # self.config = load_json(config_path)
        logger.info(
            f"AgendaManagementAgent initialized with config: {config_path}")

    async def execute(self, instruction: str, conversation_history: List[Message], current_data: Dict[str, Any], llm_model: GenerativeModel, **kwargs) -> Tuple[Dict[str, Any], str]:
        # kwargs を受け取ることで、main.pyからの他の引数（speakerNameなど）を許容
        return await handle_agenda_management_request(
            instruction=instruction,
            conversation_history=conversation_history,
            current_data=current_data,
            llm_model=llm_model
            # speaker_name は handle_agenda_management_request が直接受け取らないため渡さない
        )


async def handle_agenda_management_request(
    instruction: str,
    conversation_history: List[Message],
    current_data: Dict[str, Any],
    llm_model: GenerativeModel
) -> Tuple[Dict[str, Any], str]:
    logger.info(f"Agenda management for instruction: {instruction}")
    session_data = current_data

    # currentAgenda と suggestedNextTopics の初期値をFirebaseのオブジェクト形式に合わせる
    current_agenda_obj = session_data.get(
        "currentAgenda", {"mainTopic": "", "details": []})  # detailsをリストに
    current_main_topic = current_agenda_obj.get("mainTopic", "")

    suggested_next_topics_obj = session_data.get(
        "suggestedNextTopics", {})  # オブジェクト形式に
    if not isinstance(suggested_next_topics_obj, dict):  # リストで来てしまった場合のフォールバック
        logger.warning(
            f"suggestedNextTopics is not a dict, attempting to convert: {suggested_next_topics_obj}")
        if isinstance(suggested_next_topics_obj, list):
            suggested_next_topics_obj = {
                f"topic_{i}": topic_text for i, topic_text in enumerate(suggested_next_topics_obj)}
        else:
            suggested_next_topics_obj = {}

    if not VERTEX_AI_AVAILABLE or llm_model is None:
        logger.warning(
            "Vertex AI not available for agenda management or LLM model not provided.")
        return {"currentAgenda": current_agenda_obj, "suggestedNextTopics": suggested_next_topics_obj}, "Agenda not updated (Vertex AI unavailable or LLM model not provided)."
    try:
        model = llm_model  # 引数で受け取ったllm_modelを使用

        history_str = "\n".join(
            [f"{msg.role.capitalize()}: {msg.parts[0]['text']}" for msg in conversation_history if msg.parts and msg.parts[0].get('text')])

        # Include the entire session_data in the prompt for context
        session_data_json_str = json.dumps(
            session_data, ensure_ascii=False, indent=2)

        prompt = f"""あなたは会議のアジェンダ管理アシスタントです。
以下の現在の完全なセッションデータ（JSON形式）、過去の会話履歴（参考情報）、そして今回対応すべき新しい指示「{instruction}」を分析してください。
その上で、「現在の主要な議題の主題」、「現在の議題に関する詳細（会話の要点や背景情報など、できるだけ多く、3点以上あると望ましい）」、「次に議論すべき推奨議題のリスト（できるだけ多く、3点以上あると望ましい）」を更新し、結果を以下のJSON形式で返してください。
JSON形式: {{"current_agenda_main_topic": "更新された現在の主要議題テキスト", "current_agenda_details": ["詳細1テキスト", "詳細2テキスト"], "suggested_next_topics_list": ["更新された推奨議題1", "更新された推奨議題2"]}}
`current_agenda_details` は現在の主要議題に関連する重要な会話のポイントや補足情報を簡潔にまとめた文字列のリストです。基本的には複数出力してほしいですが、もし詳細がなければ空のリスト `[]` としてください。6項目以上など、リストが多くなりすぎた場合には、それぞれ適宜まとめてください。基本的には5項目以下にすると良いでしょう。
トランスクリプトのため、文字起こしに誤りがある場合があります。推測して補ってください。
JSONオブジェクトのみ出力してください。

現在のセッションデータ:
```json
{session_data_json_str}
```

過去の会話履歴 (参考情報):\n{history_str}
今回対応すべき新しい指示: {instruction}
更新された議題 (JSONオブジェクト):"""
        logger.info(
            f"Sending agenda prompt to LLM. Instruction: {instruction}")
        response = await model.generate_content_async(prompt)
        llm_response_text = response.text if hasattr(
            response, 'text') and response.text else ""
        if not llm_response_text and response.candidates and response.candidates[0].content.parts:
            llm_response_text = response.candidates[0].content.parts[0].text
        logger.info(f"LLM agenda response: {llm_response_text}")
        if not llm_response_text:
            # Return data in the new expected format
            return {"currentAgenda": {"mainTopic": current_main_topic, "details": []}, "suggestedNextTopics": suggested_next_topics_list}, "LLM returned empty agenda update."
        cleaned_response_text = llm_response_text.strip()
        if cleaned_response_text.startswith("```json"):
            cleaned_response_text = cleaned_response_text[7:-3].strip()
        elif cleaned_response_text.startswith("```"):
            cleaned_response_text = cleaned_response_text[3:-3].strip()
        elif cleaned_response_text.startswith("`") and cleaned_response_text.endswith("`"):
            cleaned_response_text = cleaned_response_text[1:-1].strip()

        agenda_update = json.loads(cleaned_response_text)
        if not isinstance(agenda_update, dict) or \
           "current_agenda_main_topic" not in agenda_update or \
           "current_agenda_details" not in agenda_update or \
           "suggested_next_topics_list" not in agenda_update:  # LLMはリストで返す想定
            raise ValueError(
                "LLM agenda response not a valid agenda object with new keys (main_topic, details, suggested_topics_list).")

        new_main_topic = agenda_update.get(
            "current_agenda_main_topic", current_main_topic)

        # current_agenda_details は文字列のリストとしてLLMから来ると想定
        new_details_texts_list = agenda_update.get(
            "current_agenda_details", [])
        formatted_details_list = []  # Firebase用にリスト形式に変換
        if isinstance(new_details_texts_list, list):
            for idx, text_detail in enumerate(new_details_texts_list):
                if isinstance(text_detail, str):
                    formatted_details_list.append(
                        {"id": f"detail_{idx}_{uuid.uuid4().hex[:6]}", "text": text_detail})
                elif isinstance(text_detail, dict) and "text" in text_detail:  # LLMが既にオブジェクトで返した場合
                    formatted_details_list.append({
                        "id": text_detail.get("id", f"detail_{idx}_{uuid.uuid4().hex[:6]}"),
                        "text": text_detail.get("text"),
                        "timestamp": text_detail.get("timestamp")
                    })

        # suggested_next_topics_list は文字列のリストとしてLLMから来ると想定
        new_suggested_topics_list = agenda_update.get(
            "suggested_next_topics_list", [])
        formatted_suggested_topics_obj = {}  # Firebase用にオブジェクト形式に変換
        if isinstance(new_suggested_topics_list, list):
            for idx, topic_text in enumerate(new_suggested_topics_list):
                if isinstance(topic_text, str):
                    # ユニークID生成
                    topic_id = f"nexttopic_{idx}_{uuid.uuid4().hex[:6]}"
                    formatted_suggested_topics_obj[topic_id] = {
                        "title": topic_text}  # Firebaseではオブジェクトで格納
        elif isinstance(new_suggested_topics_list, str):  # 単一文字列で来た場合
            topic_id = f"nexttopic_0_{uuid.uuid4().hex[:6]}"
            formatted_suggested_topics_obj[topic_id] = {
                "title": new_suggested_topics_list}

        return {
            "currentAgenda": {"mainTopic": new_main_topic, "details": formatted_details_list},
            "suggestedNextTopics": formatted_suggested_topics_obj
        }, "Agenda topics and details estimated by LLM."
    except Exception as e:
        logger.error(
            f"Error in handle_agenda_management_request: {e}", exc_info=True)
        return {"currentAgenda": current_agenda_obj, "suggestedNextTopics": suggested_next_topics_obj}, f"Error processing agenda with LLM: {e}"
