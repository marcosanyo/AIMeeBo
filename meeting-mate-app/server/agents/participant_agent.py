import json
from typing import List, Tuple, Dict, Any, Optional

# Vertex AI SDK
try:
    from vertexai.generative_models import GenerativeModel, Part as VertexPart
except ImportError:
    # This will be handled by VERTEX_AI_AVAILABLE from config
    pass

from models import Message
from config import logger, VERTEX_AI_AVAILABLE, VERTEX_MODEL_NAME
import uuid  # uuidがfallbackで使用されているためインポート
import os  # osモジュールをインポート


class ParticipantManagementAgent:
    def __init__(self, config_path: str):
        self.config_path = config_path
        logger.info(
            f"ParticipantManagementAgent initialized with config: {config_path}")

    async def execute(self, instruction: str, conversation_history: List[Message], current_data: Dict[str, Any], speaker_name: str, llm_model: GenerativeModel, **kwargs) -> Tuple[Dict[str, Any], str]:
        return await handle_participant_management_request(
            instruction=instruction,
            conversation_history=conversation_history,
            current_data=current_data,
            speaker_name=speaker_name,
            llm_model=llm_model
        )


async def handle_participant_management_request(
    instruction: str,
    conversation_history: List[Message],
    current_data: Dict[str, Any],
    speaker_name: str,
    llm_model: GenerativeModel
) -> Tuple[Dict[str, Any], str]:
    session_data = current_data
    # Participants are now an object, not a list
    current_participants_obj = session_data.get("participants", {})
    if not isinstance(current_participants_obj, dict):  # リストで来てしまった場合のフォールバック
        logger.warning(
            f"Participants data is not a dict, attempting to convert: {current_participants_obj}")
        if isinstance(current_participants_obj, list) and all(isinstance(p, dict) and "name" in p for p in current_participants_obj):  # IDがない古いリスト形式を想定
            # 簡単なIDを生成して辞書に変換（LLMに任せる方が良いが、フォールバックとして）
            temp_obj = {}
            for i, p_item in enumerate(current_participants_obj):
                p_id = f"participant_fallback_{i}"
                temp_obj[p_id] = {"id": p_id, "name": p_item.get(
                    "name"), "role": p_item.get("role", "参加者")}
            current_participants_obj = temp_obj
        else:
            current_participants_obj = {}

    if not VERTEX_AI_AVAILABLE or llm_model is None:
        logger.warning(
            "ParticipantAgent: Fallback logic not fully adapted for new object structure. LLM recommended.")
        if speaker_name and not any(p.get("name") == speaker_name for p in current_participants_obj.values()):
            fallback_id = f"participant_{speaker_name.lower().replace(' ', '_')}_{uuid.uuid4().hex[:4]}"
            current_participants_obj[fallback_id] = {
                "name": speaker_name, "role": "参加者"}
            return {"participants": current_participants_obj}, f"Participant '{speaker_name}' added (Vertex AI unavailable or LLM model not provided)."
        return {"participants": current_participants_obj}, "Participants update skipped (Vertex AI unavailable or no new speaker)."

    try:
        model = llm_model  # 引数で受け取ったllm_modelを使用

        history_str = "\n".join(
            [f"{msg.role.capitalize()}: {msg.parts[0]['text']}" for msg in conversation_history if msg.parts and msg.parts[0].get('text')])

        session_data_json_str = json.dumps(
            session_data, ensure_ascii=False, indent=2)

        # Check if representative mode is enabled
        representative_mode = session_data.get("representativeMode", False)
        representative_mode_context = ""
        if representative_mode:
            representative_mode_context = """
**重要: 代表参加者モードが有効です:**
- この会議では参加者は代表者として発言しており、個々の発言者の特定はできません。
- 新しい参加者を追加する際は、役割を「代表者」として設定してください。
- 発言者の身元が特定できないことを前提に参加者管理を行ってください。
"""

        prompt = f"""あなたは会議の参加者管理アシスタントです。
現在の操作者は「{speaker_name}」さんです。
以下の現在の完全なセッションデータ（JSON形式）、過去の会話履歴（参考情報）、そして今回対応すべき新しい指示「{instruction}」を分析してください。
その上で、セッションデータ内の `participants` オブジェクトを更新し、更新後の `participants` オブジェクト全体をJSON形式で返してください。
{representative_mode_context}
**参加者データ (`participants`) のスキーマ:**
`participants` は、キーが参加者ID (例: "participant_tanaka")、値が参加者情報オブジェクトとなるJSONオブジェクトです。
各参加者情報オブジェクトは、以下のキーを持ちます:
- `name` (string, 必須): 参加者の名前。
- `role` (string, 必須): 参加者の役割。不明な場合は「参加者」としてください。代表参加者モードの場合は「代表者」を使用してください。
- `joinedAt` (string, オプショナル): 参加日時 (ISO 8601形式)。

**指示の解釈と処理:**
- 新しい参加者を追加する場合: `speaker_name` さんが指示した名前で新しい参加者エントリを作成してください。IDは `participant_` + 名前（英小文字など） + `_` + 短いユニーク文字列などで生成してください。
- 既存の参加者の情報を変更する場合: 指示内容に基づいて、該当する参加者の `name` や `role` を更新してください。IDは変更しないでください。
- `speaker_name` さん自身の情報を変更する場合: `participants` オブジェクト内で `speaker_name` さんに該当するエントリ（もしあれば）の情報を更新してください。もし `speaker_name` さんがまだリストにいない場合は、新しいエントリとして追加してください。その際、IDは `participant_{speaker_name}_id` のように生成し、名前は `{speaker_name}` としてください。
- 重複は避けてください（同じ `name` の参加者が複数存在しないように、IDで区別します）。
- もし指示内容が参加者情報の変更を意図していない場合は、現在の `participants` オブジェクトをそのまま返してください。

結果はJSONオブジェクトのみ出力してください。

現在のセッションデータ:
```json
{session_data_json_str}
```

過去の会話履歴 (参考情報):\n{history_str}
今回対応すべき新しい指示 (操作者: {speaker_name}): {instruction}

更新後の参加者オブジェクト (上記スキーマのJSONオブジェクト):
例:
```json
{{
  "participant_tanaka_123": {{
    "name": "田中一郎",
    "role": "プロジェクトマネージャー",
    "joinedAt": "2024-05-20T10:00:00Z"
  }},
  "participant_suzuki_456": {{
    "name": "鈴木花子",
    "role": "開発リーダー",
    "joinedAt": "2024-05-20T10:01:00Z"
  }}
}}
```
更新後の参加者オブジェクト (JSON):"""
        logger.info(
            f"Sending participant update prompt to LLM. Instruction: {instruction}, Speaker: {speaker_name}")
        response = await model.generate_content_async(prompt)

        llm_response_text = ""
        if response.candidates and response.candidates[0].content.parts:
            llm_response_text = response.candidates[0].content.parts[0].text
        elif hasattr(response, 'text') and response.text:
            llm_response_text = response.text

        logger.info(f"LLM participant response: {llm_response_text}")
        if not llm_response_text:
            return {"participants": current_participants_obj}, "LLM returned empty participant update."

        cleaned_response_text = llm_response_text.strip()
        if cleaned_response_text.startswith("```json"):
            cleaned_response_text = cleaned_response_text[7:-3].strip()
        elif cleaned_response_text.startswith("```"):
            cleaned_response_text = cleaned_response_text[3:-3].strip()
        elif cleaned_response_text.startswith("`") and cleaned_response_text.endswith("`"):
            cleaned_response_text = cleaned_response_text[1:-1].strip()

        updated_participants_obj = json.loads(cleaned_response_text)
        if not isinstance(updated_participants_obj, dict):  # Expecting an object now
            raise ValueError(
                "LLM participant response not an object.")

        # Validate schema of each participant object within the main object
        valid_participants_obj = {}
        for p_id, p_info in updated_participants_obj.items():
            if isinstance(p_info, dict) and "name" in p_info and "role" in p_info:
                valid_participants_obj[p_id] = p_info
            else:
                logger.warning(
                    f"LLM returned participant entry with invalid schema, skipping: ID={p_id}, Data={p_info}")

        return {"participants": valid_participants_obj}, f"Participants updated by LLM. Total entries: {len(valid_participants_obj)}."
    except Exception as e:
        logger.error(
            f"Error in handle_participant_management_request: {e}", exc_info=True)
        return {"participants": current_participants_obj}, f"Error processing participants with LLM: {e}"
