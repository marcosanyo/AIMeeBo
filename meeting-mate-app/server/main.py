# Enable forward references for type hints
from __future__ import annotations

# Vertex AI設定をインポート
from config import VERTEX_AI_AVAILABLE, VERTEX_MODEL_NAME, LLM_TRIGGER_MESSAGE_COUNT
from agents.task_agent import TaskManagementAgent
from agents.participant_agent import ParticipantManagementAgent
from agents.overview_diagram_agent import OverviewDiagramAgent
from agents.notes_agent import NotesGeneratorAgent
from agents.agenda_agent import AgendaManagementAgent
from file_utils import load_json, save_json, ensure_dir_exists
from config import AGENT_CONFIG_DIR, MAX_ITERATIONS, MAX_RETRY_ATTEMPTS
from firebase_admin import credentials, auth as firebase_auth, db
import firebase_admin
import os
import json
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, validator
from typing import List, Dict, Any, Optional, TYPE_CHECKING
from dotenv import load_dotenv
import logging
from datetime import datetime, timedelta
from api_key_manager import FirebaseAPIKeyManager  # 追加
import asyncio  # 追加

# Import types only for type checking
if TYPE_CHECKING:
    from vertexai.generative_models import GenerativeModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if VERTEX_AI_AVAILABLE:
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        logger.info("Vertex AI module imported successfully.")
    except Exception as e:
        logger.error(f"Failed to import Vertex AI module: {e}")
        VERTEX_AI_AVAILABLE = False

load_dotenv()

try:
    database_url = os.getenv('FIREBASE_DATABASE_URL')
    if not database_url:
        gcp_project_id = os.getenv('GCP_PROJECT_ID')
        if gcp_project_id:
            database_url = f"https://{gcp_project_id}-default-rtdb.firebaseio.com"
            logger.info(f"FIREBASE_DATABASE_URL inferred: {database_url}")
        else:
            raise ValueError(
                "FIREBASE_DATABASE_URL and GCP_PROJECT_ID not set.")
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={'databaseURL': database_url})
    logger.info("Firebase Admin SDK initialized.")
except Exception as e:
    logger.error(f"Error initializing Firebase Admin SDK: {e}")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

agenda_agent = AgendaManagementAgent(config_path=os.path.join(
    AGENT_CONFIG_DIR, "agenda_agent_config.json"))
notes_agent = NotesGeneratorAgent(config_path=os.path.join(
    AGENT_CONFIG_DIR, "notes_agent_config.json"))
overview_diagram_agent = OverviewDiagramAgent(config_path=os.path.join(
    AGENT_CONFIG_DIR, "overview_diagram_agent_config.json"))
participant_agent = ParticipantManagementAgent(
    config_path=os.path.join(AGENT_CONFIG_DIR, "participant_agent_config.json"))
task_agent = TaskManagementAgent(config_path=os.path.join(
    AGENT_CONFIG_DIR, "task_agent_config.json"))

api_key_manager = FirebaseAPIKeyManager()  # 追加

ALLOWED_DEMO_ROOM = "demo_zenn"

def verify_demo_room_access(room_id: str):
    """デモ版のルーム制限をチェック"""
    if room_id != ALLOWED_DEMO_ROOM:
        raise HTTPException(
            status_code=403,
            detail=f"Demo version: Only '{ALLOWED_DEMO_ROOM}' room is accessible"
        )

# LLMとのやり取りやフロントエンドからの入力に使用するPydanticモデル


class LLMMessage(BaseModel):
    role: str
    parts: List[Dict[str, str]] = Field(
        default_factory=lambda: [{"text": "[内容なし]"}])

    @field_validator('parts', mode='before')
    def ensure_parts_has_text(cls, v):
        if not v:
            return [{"text": "[内容なし]"}]
        if isinstance(v, list) and len(v) > 0:
            validated_parts = []
            for part in v:
                if isinstance(part, dict) and 'text' not in part:
                    validated_parts.append({'text': '[内容なし]', **part})
                elif not isinstance(part, dict):
                    validated_parts.append({'text': f'[不正なpart: {str(part)}]'})
                else:
                    validated_parts.append(part)
            return validated_parts
        return v

# DB保存用トランスクリプトエントリのPydanticモデル (ユーザー提案スキーマベース)


class DBTranscriptEntry(BaseModel):
    text: str
    userId: str  # ユーザーのUID
    userName: Optional[str] = None  # ユーザーの表示名 (displayName)
    timestamp: str  # ISO format string
    role: Optional[str] = None  # 'user' or 'ai'


class TaskPayload(BaseModel):
    taskId: str
    messages: List[LLMMessage]  # フロントエンドからは最新のメッセージ1件 (LLMMessage形式)
    roomId: Optional[str] = "default_room"
    speakerId: str  # 発言者のUID
    speakerName: Optional[str] = "Unknown Speaker"  # 発言者の表示名
    llmApiKey: Optional[str] = None  # LLM APIキーを追加
    # ... (他のフィールドは変更なし)
    currentParticipants: Optional[List[Dict[str, Any]]] = None
    currentTasks: Optional[List[Dict[str, Any]]] = None
    currentNotes: Optional[List[Dict[str, Any]]] = None
    currentAgenda: Optional[Dict[str, Any]] = None
    currentOverviewDiagram: Optional[Dict[str, Any]] = None
    suggestedNextTopics: Optional[List[str]] = None


class JsonRpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Dict[str, TaskPayload]
    id: str


class AgentResult(BaseModel):
    invokedAgents: List[str] = []
    # ... (他のフィールドは変更なし)
    updatedParticipants: Optional[List[Dict[str, Any]]] = None
    updatedTasks: Optional[List[Dict[str, Any]]] = None
    updatedNotes: Optional[List[Dict[str, Any]]] = None
    updatedAgenda: Optional[Dict[str, Any]] = None
    updatedOverviewDiagram: Optional[Dict[str, Any]] = None


class JsonRpcResponse(BaseModel):
    jsonrpc: str = "2.0"
    result: Optional[AgentResult] = None
    error: Optional[Dict[str, Any]] = None
    id: str

# ... (JoinRoomRequest, join_room_endpoint は変更なし)


class JoinRoomRequest(BaseModel):
    idToken: str
    roomId: str
    speakerName: Optional[str] = "Unknown User"  # 参加者の表示名を追加


class AddMessageRequest(BaseModel):
    idToken: str
    roomId: str
    message: str
    speakerName: Optional[str] = "Unknown User"


@app.post("/join_room", summary="Request to join a meeting room")
async def join_room_endpoint(request_data: JoinRoomRequest):
    try:
        decoded_token = firebase_auth.verify_id_token(request_data.idToken)
        uid = decoded_token['uid']
        user_record = firebase_auth.get_user(uid)
        display_name = request_data.speakerName or user_record.display_name or user_record.email or f"user_{uid[:5]}"

        room_ref = db.reference(f"rooms/{request_data.roomId}")
        room_data = room_ref.get()

        if not room_data:
            raise HTTPException(status_code=404, detail="Room not found.")

        # 既にルームの参加者であるか確認
        if room_data.get("participants", {}).get(uid):
            return {"status": "success", "message": "User is already a participant in this room."}

        # 参加者として追加
        participant_data = {
            "name": display_name,
            "role": "Participant",  # 新規参加者はParticipantとする
            "joinedAt": datetime.utcnow().isoformat() + "Z"
        }
        room_ref.child(f"participants/{uid}").set(participant_data)
        logger.info(
            f"User {display_name} ({uid}) joined room {request_data.roomId}.")
        return {"status": "success", "message": "User successfully joined the room."}

    except Exception as e:
        logger.error(
            f"Error in /join_room for room {request_data.roomId}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/add_message", summary="Add message to conversation history (for demo)")
async def add_message_endpoint(request_data: AddMessageRequest):
    """会話履歴にメッセージを追加（デモルーム専用、AI処理なし）"""
    verify_demo_room_access(request_data.roomId)
    try:
        decoded_token = firebase_auth.verify_id_token(request_data.idToken)
        uid = decoded_token['uid']
        user_record = firebase_auth.get_user(uid)

        display_name = (
            request_data.speakerName or
            user_record.display_name or
            user_record.email or
            f"user_{uid[:5]}"
        )

        room_ref = db.reference(f"rooms/{request_data.roomId}")
        if not room_ref.get():
            raise HTTPException(status_code=404, detail="Demo room not found")

        new_db_entry = DBTranscriptEntry(
            text=request_data.message,
            userId=uid,
            userName=display_name,
            timestamp=datetime.utcnow().isoformat() + "Z",
            role="user"
        )

        transcript_ref = room_ref.child("transcript")
        current_transcript_list = transcript_ref.get()
        if not isinstance(current_transcript_list, list):
            current_transcript_list = []
        current_transcript_list.append(new_db_entry.model_dump())
        transcript_ref.set(current_transcript_list)

        logger.info(
            f"Message added to demo room {request_data.roomId} by {display_name}")
        return {
            "status": "success",
            "message": "Message added to conversation history",
        }
    except Exception as e:
        logger.error(
            f"Error in /add_message for room {request_data.roomId}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Unexpected error: {str(e)}")


async def process_single_agent(agent, task_payload: TaskPayload, agent_name: str, instruction_text: str, results_dict: dict, conversation_history_for_agent: List[LLMMessage], llm_model_instance: GenerativeModel):
    logger.info(
        f"Invoking {agent_name} for task {task_payload.taskId} in room {task_payload.roomId} with instruction: '{instruction_text}'")
    try:
        if hasattr(agent, 'execute'):
            room_ref_path = f"rooms/{task_payload.roomId}"
            room_data_snapshot = db.reference(room_ref_path).get() or {}
            current_data_for_agent = {
                "participants": room_data_snapshot.get("participants"),
                "tasks": room_data_snapshot.get("tasks"),
                "notes": room_data_snapshot.get("notes"),
                "agenda": room_data_snapshot.get("currentAgenda"),
                "overviewDiagram": room_data_snapshot.get("overviewDiagram"),
                "suggestedNextTopics": room_data_snapshot.get("suggestedNextTopics"),
                "full_room_data": room_data_snapshot
            }
            task_payload.currentParticipants = current_data_for_agent["participants"]
            task_payload.currentTasks = current_data_for_agent["tasks"]
            task_payload.currentNotes = current_data_for_agent["notes"]
            task_payload.currentAgenda = current_data_for_agent["agenda"]
            task_payload.currentOverviewDiagram = current_data_for_agent["overviewDiagram"]
            task_payload.suggestedNextTopics = current_data_for_agent["suggestedNextTopics"]

            agent_specific_args = {
                "instruction": instruction_text,
                "conversation_history": conversation_history_for_agent,
                "current_data": current_data_for_agent,
                "room_id": task_payload.roomId,
                "speaker_id": task_payload.speakerId,  # speakerIdを追加
                "speaker_name": task_payload.speakerName,
                "llm_model": llm_model_instance  # LLMモデルインスタンスを渡す
            }
            updated_data_from_agent, user_message_text = await agent.execute(**agent_specific_args)

            if updated_data_from_agent:
                for key, value in updated_data_from_agent.items():
                    if value is not None:
                        db_key = key
                        if key == "agenda":
                            db_key = "currentAgenda"
                        elif key == "overview_diagram":
                            db_key = "overviewDiagram"
                        db.reference(f"{room_ref_path}/{db_key}").set(value)

            results_dict[agent_name] = {
                "data": updated_data_from_agent, "message": user_message_text}
            logger.info(
                f"{agent_name} processed successfully. Message: {user_message_text}")
        else:
            results_dict[agent_name] = {
                "error": f"{agent_name} does not have an execute method."}
    except Exception as e:
        logger.error(f"Error processing {agent_name}: {e}", exc_info=True)
        results_dict[agent_name] = {"error": str(e)}


async def orchestrate_agents(task_payload: TaskPayload, background_tasks: BackgroundTasks, db_transcript_entries: List[Dict[str, Any]], llm_api_key: Optional[str] = None):
    logger.info(
        f"Orchestrating agents for task: {task_payload.taskId}, room: {task_payload.roomId}")

    if not VERTEX_AI_AVAILABLE:
        raise HTTPException(
            status_code=503, detail="Vertex AI is not available.")

    current_llm_model: Optional[GenerativeModel] = None

    try:
        from config import PROJECT_ID, REGION
        if not PROJECT_ID or not REGION:
            logger.error(
                "PROJECT_ID or REGION not set in config. Cannot initialize Vertex AI.")
            raise HTTPException(
                status_code=503, detail="LLM service unavailable: Server configuration error (PROJECT_ID/REGION missing).")

        # FirebaseからAPIキーを取得
        retrieved_llm_api_key = None
        try:
            retrieved_llm_api_key = api_key_manager.get_room_api_key(task_payload.roomId)
        except Exception as e:
            logger.error(f"Error retrieving API key: {e}", exc_info=True)
            raise HTTPException(
                status_code=503, detail=f"LLM service unavailable: Error retrieving API key: {str(e)}")
        
        # 環境変数からデフォルトのAPIキーを取得
        default_api_key = os.environ.get('DEFAULT_VERTEX_API_KEY')
        
        # APIキーの優先順位: 1. Firebaseから取得したキー 2. 環境変数のデフォルトキー 3. 引数で渡されたキー
        final_api_key = retrieved_llm_api_key or default_api_key or llm_api_key
        
        if not final_api_key:
            logger.error(f"No LLM API key found for room {task_payload.roomId}.")
            raise HTTPException(
                status_code=503, detail="LLM service unavailable: No API key available for this room.")

        # Vertex AIを初期化
        try:
            vertexai.init(project=PROJECT_ID, location=REGION,
                          api_key=final_api_key)
            logger.info("Vertex AI initialized with API key.")
        except ValueError as ve:
            if "already been initialized" in str(ve):
                logger.warning(
                    "Vertex AI already initialized. Attempting to use existing initialization.")
            else:
                raise ve
        except Exception as e:
            logger.error(
                f"Failed to initialize Vertex AI: {e}", exc_info=True)
            # Check if the error is related to API key authentication
            error_str = str(e).lower()
            if any(keyword in error_str for keyword in ['api key', 'authentication', 'credentials', 'unauthorized', 'forbidden', 'invalid key']):
                raise HTTPException(
                    status_code=503, detail=f"LLM service unavailable: Invalid or expired Gemini API key. Please check your API key configuration.")
            else:
                raise HTTPException(
                    status_code=503, detail=f"LLM service unavailable: Failed to initialize Vertex AI: {e}")

        # LLMモデルの選択ロジック
        llm_models_from_secrets = db.reference(
            f"room_secrets/{task_payload.roomId}/llm_models").get()

        selected_llm_model_name = VERTEX_MODEL_NAME  # デフォルトモデル

        if llm_models_from_secrets and isinstance(llm_models_from_secrets, list) and len(llm_models_from_secrets) > 0:
            # 最初の利用可能なモデルを選択
            selected_llm_model_name = llm_models_from_secrets[0]
            logger.info(
                f"Using LLM model from room_secrets: {selected_llm_model_name}")
        else:
            logger.info(
                f"No specific LLM model found in room_secrets for room {task_payload.roomId}. Using default: {selected_llm_model_name}")

        # GenerativeModelをインスタンス化
        try:
            current_llm_model = GenerativeModel(selected_llm_model_name)
            logger.info(
                f"Vertex AI model '{selected_llm_model_name}' instantiated.")
        except Exception as e:
            logger.error(
                f"Failed to instantiate Vertex AI model: {e}", exc_info=True)
            # Check if the error is related to API key authentication during model instantiation
            error_str = str(e).lower()
            if any(keyword in error_str for keyword in ['api key', 'authentication', 'credentials', 'unauthorized', 'forbidden', 'invalid key']):
                raise HTTPException(
                    status_code=503, detail=f"LLM service unavailable: Invalid or expired Gemini API key. Please check your API key configuration.")
            else:
                raise HTTPException(
                    status_code=503, detail=f"LLM service unavailable: Failed to instantiate Vertex AI model '{selected_llm_model_name}': {e}")

    except Exception as e:
        logger.error(
            f"Failed to initialize or instantiate Vertex AI: {e}", exc_info=True)
        # Check if the error is related to API key authentication
        error_str = str(e).lower()
        if any(keyword in error_str for keyword in ['api key', 'authentication', 'credentials', 'unauthorized', 'forbidden', 'invalid key']):
            raise HTTPException(
                status_code=503, detail=f"LLM service unavailable: Invalid or expired Gemini API key. Please check your API key configuration.")
        else:
            raise HTTPException(
                status_code=503, detail=f"LLM service unavailable or failed to initialize: {e}")
    finally:
        pass

    if current_llm_model is None:
        raise HTTPException(
            status_code=503, detail="LLM service unavailable or failed to initialize.")

    room_ref_path = f"rooms/{task_payload.roomId}"

    # DBから読み込んだ新スキーマのトランスクリプトをLLM用のLLMMessage形式に変換
    llm_transcript_messages: List[LLMMessage] = []
    for entry_dict in db_transcript_entries:
        try:
            # DBスキーマからLLMMessageへの変換ロジック
            text = entry_dict.get("text", "[内容なし]")
            # userNameを優先し、なければuserIdを使用
            speaker_name_for_llm = entry_dict.get(
                "userName") or ""  # userNameがなければ空文字列

            # roleフィールドに応じてLLMMessageのroleを決定
            entry_role = (entry_dict.get("role") or "").lower()
            if entry_role == "user":
                llm_role = "user"
            elif entry_role == "ai":
                llm_role = "model"  # Vertex AI互換
            else:
                # roleが未設定またはunknownの場合はuserとして扱う（参加者の発言）
                llm_role = "user"

            if not speaker_name_for_llm:
                logger.warning(
                    f"Transcript entry missing 'userName' field: {entry_dict}. Using empty string for speaker name.")

            llm_transcript_messages.append(
                # 発言者名もメッセージに含める
                LLMMessage(role=llm_role, parts=[{"text": f"{speaker_name_for_llm}: {text}"}]))
        except Exception as e:
            logger.error(
                f"Error converting DB transcript entry to LLMMessage: {entry_dict}, Error: {e}", exc_info=True)
            # エラー時はスキップするか、エラーを示すメッセージを追加するか
            llm_transcript_messages.append(LLMMessage(
                role="user", parts=[{"text": "[変換エラー]"}]))

    session_data_for_llm_context = db.reference(room_ref_path).get() or {}
    session_data_for_llm_context['transcript'] = [
        msg.model_dump() for msg in llm_transcript_messages]
    session_data_json_str = json.dumps(
        session_data_for_llm_context, ensure_ascii=False, indent=2)

    history_parts = []
    user_prompt = ""

    if llm_transcript_messages:
        if len(llm_transcript_messages) > 1:
            for msg_model in llm_transcript_messages[:-1]:
                part_text = msg_model.parts[0].get('text', '[content missing]')
                history_parts.append(f"{msg_model.role}: {part_text}")
        latest_msg_model = llm_transcript_messages[-1]
        user_prompt = latest_msg_model.parts[0].get(
            'text', '[empty user prompt]')

    history_str = "\n".join(history_parts)
    logger.info(
        f"Latest user prompt for dispatch: '{user_prompt}' by {task_payload.speakerName}")
    logger.debug(f"History for LLM: \n{history_str}")

    available_agents = ["TaskManagementAgent", "NotesGeneratorAgent",
                        "AgendaManagementAgent", "OverviewDiagramAgent"]
    available_agents_str = ", ".join(available_agents)

    # Check if representative mode is enabled
    representative_mode = session_data_for_llm_context.get("representativeMode", False)
    representative_mode_context = ""
    if representative_mode:
        representative_mode_context = """
**重要: 代表参加者モードが有効です:**
この会議では参加者は代表者として発言しており、個々の発言者の特定はできません。
各エージェントに渡す指示では、発言者が特定できないことを考慮してください。
"""

    dispatch_prompt_template = f"""あなたは会議中の発言を解釈し、適切な専門エージェントを呼び出すAIオーケストレーターです。
以下の指示に従って、呼び出すべきエージェントとその指示内容をJSON形式で応答してください。
{representative_mode_context}

利用可能な専門エージェントのリストとそれぞれの役割:
- **TaskManagementAgent**: 会議中のタスク（TODO、進行中、完了）の追加、更新、削除、担当者や期限の設定など、タスクリストの管理を行います。
- **NotesGeneratorAgent**: 会議中の重要なメモ、決定事項、課題などを記録・要約し、ノートリストを生成・更新します。
- **AgendaManagementAgent**: 会議の主要議題や詳細、次に議論すべき推奨議題を管理・更新します。
- **OverviewDiagramAgent**: 会議の内容やプロジェクトの構造を視覚的に表現するMermaid.jsの概要図を生成・更新します。

応答形式の厳守のお願い:
応答は必ず以下のJSON形式のリストとしてください。
`[
  {{"agent_name": "上記リストから選択したエージェント名", "instruction": "選択したエージェントへの具体的な指示内容（文字列）"}},
  ...
]`
- `agent_name` には、必ず上記リスト内のエージェント名を指定してください。
- `instruction` には、そのエージェントに実行させたい具体的な指示を、簡潔な日本語の文字列で記述してください。複雑な構造化データは含めないでください。
- 複数のエージェントを呼び出す必要がある場合は、リスト内に複数のオブジェクトを含めてください。
- 呼び出すべき適切なエージェントが存在しない場合は、空のリスト `[]` を返してください。

具体例:
- タスク管理エージェントに新しいタスクを登録する場合:
  `[ {{"agent_name": "TaskManagementAgent", "instruction": "新しいタスク「API仕様書の作成」を登録してください"}} ]`
- アジェンダ管理エージェントに現在のアジェンダを更新する場合:
  `[ {{"agent_name": "AgendaManagementAgent", "instruction": "現在のアジェンダのメイントピックを「次期プロジェクトの計画」に変更してください"}} ]`
- 該当するエージェントがない場合:
  `[]`

現在のセッションデータ:
```json
{session_data_json_str}
```
会話履歴:
{history_str}
最新発言: {task_payload.speakerName}: {user_prompt}

上記を踏まえ、会話履歴全体を考慮しつつ、特に最新の{LLM_TRIGGER_MESSAGE_COUNT}発言に注目して、呼び出すべきエージェントと指示をJSONリスト形式で出力してください。基本的には3つ以上のエージェントが関係する場合が多いはずです。:"""

    # プロンプトをログに出力
    logger.info(f"Prompt sent to Orchestrator LLM:\n{dispatch_prompt_template}")

    llm_response = await current_llm_model.generate_content_async(dispatch_prompt_template)
    # ... (LLM応答パースとエージェント起動のロジックは前回の修正を流用)
    llm_dispatch_decision_text = getattr(llm_response, 'text', "")
    if not llm_dispatch_decision_text and getattr(llm_response, 'candidates', None) and llm_response.candidates[0].content.parts:
        llm_dispatch_decision_text = llm_response.candidates[0].content.parts[0].text
    # 生の応答テキストをログに出力
    logger.info(
        f"Raw Orchestrator LLM response text: {llm_dispatch_decision_text}")

    if llm_dispatch_decision_text.strip().startswith("```json"):
        llm_dispatch_decision_text = llm_dispatch_decision_text.strip()[
            7:-3].strip()
    elif llm_dispatch_decision_text.strip().startswith("```"):
        llm_dispatch_decision_text = llm_dispatch_decision_text.strip()[
            3:-3].strip()
    try:
        dispatch_actions = json.loads(
            llm_dispatch_decision_text) if llm_dispatch_decision_text else []
        if not isinstance(dispatch_actions, list):
            dispatch_actions = []
    except json.JSONDecodeError:
        logger.error(
            f"Failed to parse orchestrator LLM response: {llm_dispatch_decision_text}.")
        dispatch_actions = []

    all_agents_map = {
        "TaskManagementAgent": task_agent, "NotesGeneratorAgent": notes_agent,
        "AgendaManagementAgent": agenda_agent, "OverviewDiagramAgent": overview_diagram_agent,
    }
    results_from_agents = {}
    active_agent_names = []
    agent_instructions_map = {}  # エージェントへの指示を保存する辞書

    agent_tasks = []  # エージェントタスクを保持するリスト

    for action in dispatch_actions:
        agent_name = action.get("agent_name")
        instruction = action.get("instruction")
        if instruction is None:
            logger.warning(
                f"Action for agent '{agent_name}' missing 'instruction'. Using user_prompt. Action: {action}")
            instruction = user_prompt
        if not agent_name or not isinstance(agent_name, str):
            logger.warning(
                f"Invalid agent_name in action: {action}. Skipping.")
            continue
        agent_instance = all_agents_map.get(agent_name)
        if agent_instance:
            logger.info(
                f"Scheduling agent: {agent_name} with instruction: '{instruction}'")
            agent_instructions_map[agent_name] = instruction  # 指示を保存
            # 正しいasyncio.create_taskの使い方
            task = asyncio.create_task(
                process_single_agent(
                    agent_instance,
                    task_payload,
                    agent_name,
                    instruction,
                    results_from_agents,
                    llm_transcript_messages,
                    current_llm_model
                )
            )
            agent_tasks.append(task)
            active_agent_names.append(agent_name)
        else:
            logger.warning(
                f"Agent '{agent_name}' not found. Skipping action: {action}")

    # すべてのエージェントタスクが完了するのを待つ
    if agent_tasks:
        await asyncio.gather(*agent_tasks)

    # エージェントへの指示をトランスクリプトに追記
    # 安全にトランスクリプトを更新するため、最新のデータを取得して更新する
    transcript_ref = db.reference(f"{room_ref_path}/transcript")
    
    # 最新のトランスクリプトを取得
    current_transcript_list = transcript_ref.get()
    if current_transcript_list is None or not isinstance(current_transcript_list, list):
        current_transcript_list = []

    # エージェント名とアイコン・短縮名の対応関係
    agent_display_config = {
        "TaskManagementAgent": {"icon": "🗂️", "short_name": "Task"},
        "NotesGeneratorAgent": {"icon": "📝", "short_name": "Notes"},
        "AgendaManagementAgent": {"icon": "📋", "short_name": "Agenda"},
        "OverviewDiagramAgent": {"icon": "🗺️", "short_name": "Diagram"}
    }
    
    ai_messages_to_append = []
    for agent_name in active_agent_names:  # 実際に呼び出されたエージェントのみを対象
        instruction_text = agent_instructions_map.get(agent_name)
        if instruction_text:
            config = agent_display_config.get(agent_name, {"icon": "🤖", "short_name": agent_name})
            ai_messages_to_append.append(
                f"{config['icon']} {config['short_name']}：{instruction_text}")

    if ai_messages_to_append:
        ai_message_text = "\n".join(ai_messages_to_append)
        new_ai_entry = DBTranscriptEntry(
            text=ai_message_text,
            userId="ai",  # AIの識別子
            userName="AI",  # AIの表示名
            timestamp=datetime.utcnow().isoformat() + "Z",
            role="ai"  # ロールを'ai'に設定
        )
        
        # トランスクリプトの更新を試みる（競合状態を避けるため）
        try:
            # 最新のトランスクリプトを再取得して更新
            latest_transcript = transcript_ref.get() or []
            if not isinstance(latest_transcript, list):
                latest_transcript = []
            
            latest_transcript.append(new_ai_entry.model_dump())
            transcript_ref.set(latest_transcript)
            logger.info(f"Appended AI instructions to transcript. New length: {len(latest_transcript)}")
            
            # AIメッセージの追加後にカウンターを更新しない（ユーザーメッセージのみをカウント対象とするため）
        except Exception as e:
            logger.error(f"Error updating transcript: {e}", exc_info=True)
            # エラーが発生しても処理を継続
    else:
        logger.info("No AI instructions to append to transcript.")

    # 最新のroomデータを取得して返却用に利用
    room_data_after_scheduling = db.reference(room_ref_path).get() or {}

    final_result = AgentResult(
        invokedAgents=active_agent_names,
        updatedParticipants=list(room_data_after_scheduling.get("participants", {}).values(
        )) if room_data_after_scheduling.get("participants") else None,
        updatedTasks=list(room_data_after_scheduling.get(
            "tasks", {}).values()) if room_data_after_scheduling.get("tasks") else None,
        updatedNotes=list(room_data_after_scheduling.get(
            "notes", {}).values()) if room_data_after_scheduling.get("notes") else None,
        updatedAgenda=room_data_after_scheduling.get("currentAgenda"),
        updatedOverviewDiagram=room_data_after_scheduling.get(
            "overviewDiagram")
    )
    return final_result


@app.post("/invoke", response_model=JsonRpcResponse, summary="Invoke AIMeeBo Agent")
async def invoke_agent(request: JsonRpcRequest, background_tasks: BackgroundTasks):
    if request.method != "ExecuteTask":
        return JsonRpcResponse(error={"code": -32601, "message": "Method not found"}, id=request.id)

    task_payload_dict = request.params.get("task")
    if not task_payload_dict:
        return JsonRpcResponse(error={"code": -32602, "message": "Invalid params: 'task' payload missing"}, id=request.id)

    # Pydanticモデルに変換
    task_payload: TaskPayload = request.params.get("task")

    room_id = task_payload.roomId
    if not room_id:
        return JsonRpcResponse(error={"code": -32602, "message": "Invalid params: 'roomId' missing"}, id=request.id)

    try:
        room_ref = db.reference(f"rooms/{room_id}")
        transcript_ref = room_ref.child("transcript")

        if task_payload.messages and len(task_payload.messages) == 1:
            latest_llm_message = task_payload.messages[0]  # LLMMessage形式
            if latest_llm_message.parts:  # partsがあることを確認
                text_to_save = latest_llm_message.parts[0].get(
                    'text', '[内容なし]')

                # Firebaseから参加者情報を取得し、displayNameを優先的に使用
                participant_info = room_ref.child(
                    f"participants/{task_payload.speakerId}").get()
                resolved_speaker_name = participant_info.get(
                    "name") if participant_info else task_payload.speakerName

                new_db_entry = DBTranscriptEntry(
                    text=text_to_save,
                    userId=task_payload.speakerId,  # フロントから来たspeakerIdを使用
                    userName=resolved_speaker_name,  # Firebaseの参加者名を使用
                    timestamp=datetime.utcnow().isoformat() + "Z",
                    role="user"  # ユーザーの発言として明示的に設定
                )
                new_db_entry_dict = new_db_entry.model_dump()

                current_transcript_list = transcript_ref.get()
                if current_transcript_list is None or not isinstance(current_transcript_list, list):
                    current_transcript_list = []
                current_transcript_list.append(new_db_entry_dict)
                transcript_ref.set(current_transcript_list)
                logger.info(
                    f"[{room_id}] Appended new message to transcript (DB schema). New length: {len(current_transcript_list)}")
            else:  # partsがない場合 (通常ありえないが念のため)
                logger.warning(
                    f"[{room_id}] Received message with no parts: {latest_llm_message}. Skipping transcript append.")

        elif task_payload.messages:
            logger.warning(
                f"[{room_id}] task_payload.messages contained {len(task_payload.messages)} messages, expected 1. Processing only the first one.")
            # (上記と同様の処理を最初のメッセージに対して行う)
            latest_llm_message = task_payload.messages[0]
            if latest_llm_message.parts:
                text_to_save = latest_llm_message.parts[0].get(
                    'text', '[内容なし]')
                # Firebaseから参加者情報を取得し、displayNameを優先的に使用
                participant_info = room_ref.child(
                    f"participants/{task_payload.speakerId}").get()
                resolved_speaker_name = participant_info.get(
                    "name") if participant_info else task_payload.speakerName

                new_db_entry = DBTranscriptEntry(
                    text=text_to_save,
                    userId=task_payload.speakerId,
                    userName=resolved_speaker_name,
                    timestamp=datetime.utcnow().isoformat() + "Z",
                    role="user"  # ユーザーの発言として明示的に設定
                )
                # ... (追記処理)

        # デモルームの場合はここで処理を終了
        if room_id == ALLOWED_DEMO_ROOM:
            logger.info(
                f"[{room_id}] Demo room message. Skipping AI processing.")
            return JsonRpcResponse(result=AgentResult(invokedAgents=[]), id=request.id)

        room_data = room_ref.get()
        if room_data is None:
            return JsonRpcResponse(error={"code": -32000, "message": f"Server error: Room {room_id} disappeared"}, id=request.id)

        db_transcript_entries = room_data.get(
            "transcript", [])  # これは新スキーマの辞書のリスト
        
        # ユーザーメッセージのみをカウント（AIメッセージを除外）
        user_messages = [entry for entry in db_transcript_entries if entry.get("role") != "ai"]
        current_user_message_count = len(user_messages)

        last_processed_count = room_data.get(
            "last_llm_processed_message_count", 0)
        if last_processed_count > current_user_message_count:
            last_processed_count = 0
            room_ref.child("last_llm_processed_message_count").set(0)
            logger.warning(
                f"[{room_id}] Reset last_llm_processed_message_count to 0.")

        logger.info(
            f"[{room_id}] Current user messages: {current_user_message_count}, Last processed: {last_processed_count}, Trigger: {LLM_TRIGGER_MESSAGE_COUNT}")

        # 処理中フラグをチェック
        is_processing = room_data.get("is_llm_processing", False)
        if is_processing:
            logger.info(f"[{room_id}] LLM processing already in progress. Skipping.")
            return JsonRpcResponse(result=AgentResult(invokedAgents=[]), id=request.id)

        if (current_user_message_count - last_processed_count) >= LLM_TRIGGER_MESSAGE_COUNT:
            logger.info(f"[{room_id}] Triggering LLM processing.")
            
            # 処理中フラグを設定
            room_ref.child("is_llm_processing").set(True)
            
            try:
                # llmApiKeyを渡す
                agent_processing_result = await orchestrate_agents(task_payload, background_tasks, db_transcript_entries, task_payload.llmApiKey)
                
                # 処理完了後にカウンターを更新
                room_ref.child("last_llm_processed_message_count").set(current_user_message_count)
                
                # 処理中フラグをクリア
                room_ref.child("is_llm_processing").set(False)
                
                return JsonRpcResponse(result=agent_processing_result, id=request.id)
            except Exception as e:
                # エラーが発生した場合、ログに記録し、クライアントにエラーを返す
                logger.error(f"[{room_id}] Error in orchestrate_agents: {e}", exc_info=True)
                
                # 処理中フラグをクリア
                room_ref.child("is_llm_processing").set(False)
                
                return JsonRpcResponse(error={"code": -32000, "message": f"LLM processing error: {str(e)}"}, id=request.id)
        else:
            return JsonRpcResponse(result=AgentResult(invokedAgents=[]), id=request.id)

    except Exception as e:
        logger.error(f"Error in /invoke: {e}", exc_info=True)
        return JsonRpcResponse(error={"code": -32000, "message": f"Server error: {e}"}, id=request.id)

# ... (create_room_endpoint は変更なし)


class CreateRoomRequest(BaseModel):
    idToken: str
    room_id: str
    room_name: Optional[str] = None
    meeting_subtitle: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_models: Optional[List[str]] = None
    speakerName: Optional[str] = None  # speakerNameを追加
    representativeMode: Optional[bool] = False  # 代表参加者モード
    api_key_duration_hours: Optional[int] = 24  # APIキーの持続時間（時間）
    
    @field_validator('api_key_duration_hours')
    @classmethod
    def validate_api_key_duration(cls, v):
        if v is not None:
            if not isinstance(v, int):
                raise ValueError('APIキー持続時間は整数で指定してください')
            if v < 1:
                raise ValueError('APIキー持続時間は1時間以上で指定してください')
            if v > 8760:  # 1年 = 365 * 24 = 8760時間
                raise ValueError('APIキー持続時間は1年（8760時間）以下で指定してください')
        return v


@app.post("/create_room", summary="Create a new meeting room")
async def create_room_endpoint(request_data: CreateRoomRequest):
    room_id = request_data.room_id
    if room_id == ALLOWED_DEMO_ROOM:
        raise HTTPException(
            status_code=400, detail=f"Room ID '{ALLOWED_DEMO_ROOM}' is reserved for demo purposes.")

    room_name = request_data.room_name or f"Room {room_id}"
    try:
        decoded_token = firebase_auth.verify_id_token(request_data.idToken)
        uid = decoded_token['uid']
        user_record = firebase_auth.get_user(uid)
        # speakerNameが提供されていればそれを使用、なければ既存のロジック
        display_name = request_data.speakerName or user_record.display_name or user_record.email or f"user_{uid[:5]}"

        room_ref = db.reference(f"rooms/{room_id}")
        if room_ref.get():
            # ルームが既に存在する場合、作成者がそのルームの参加者として追加されているか確認
            if room_ref.child(f"participants/{uid}").get():
                return {"status": "success", "message": "Room already exists and you are a participant.", "data": room_ref.get()}
            else:
                # ルームは存在するが、作成者が参加者ではない場合、参加者として追加
                participant_role = "Representative" if request_data.representativeMode else "Creator"
                participant_data = {"name": display_name, "role": participant_role,
                                    "joinedAt": datetime.utcnow().isoformat() + "Z"}
                room_ref.child(f"participants/{uid}").set(participant_data)
                return {"status": "success", "message": "Room already exists, added you as a participant.", "data": room_ref.get()}

        meeting_subtitle = request_data.meeting_subtitle or ""

        # Firebase Realtime Databaseからtemplateルームのデータを読み込む
        template_room_ref = db.reference("rooms/template")
        template_room_data = template_room_ref.get()

        if not template_room_data:
            logger.error(
                "Template room data not found in Firebase at rooms/template")
            # templateルームが存在しない場合は、最低限の初期データでルームを作成
            logger.warning("Using minimal initial data for the new room.")
            new_room_data = {
                "sessionId": f"session_{room_id}",
                "sessionTitle": room_name,
                "meetingSubtitle": meeting_subtitle,
                "startTime": datetime.utcnow().isoformat() + "Z",
                "ownerId": uid,
                "participants": {},
                "tasks": [],
                "notes": [],
                "overviewDiagram": {"title": "会議の概要図", "mermaidDefinition": "graph TD;\nA[会議開始];"},
                "currentAgenda": {"mainTopic": "会議開始", "details": []},
                "suggestedNextTopics": [],
                "transcript": [],
                "last_llm_processed_message_count": 0,
                "is_llm_processing": False,
                "representativeMode": request_data.representativeMode or False
            }
        else:
            # テンプレートデータをコピーし、新しいルームの情報を設定
            new_room_data = template_room_data.copy()
            new_room_data["sessionId"] = f"session_{room_id}"
            new_room_data["sessionTitle"] = room_name
            new_room_data["meetingSubtitle"] = meeting_subtitle
            new_room_data["startTime"] = datetime.utcnow().isoformat() + "Z"
            new_room_data["ownerId"] = uid
            # テンプレートの参加者リストは引き継がず、作成者のみを追加
            new_room_data["participants"] = {}
            new_room_data["last_llm_processed_message_count"] = 0
            new_room_data["is_llm_processing"] = False
            new_room_data["representativeMode"] = request_data.representativeMode or False

        # 作成者を参加者として追加
        participant_role = "Representative" if request_data.representativeMode else "Creator"
        new_room_data["participants"][uid] = {
            "name": display_name,
            "role": participant_role,
            "joinedAt": datetime.utcnow().isoformat() + "Z"
        }

        room_ref.set(new_room_data)

        # room_secretsにAPIキーとLLMモデルを保存
        room_secrets_ref = db.reference(f"room_secrets/{room_id}")
        secrets_data = {
            'created_at': datetime.utcnow().isoformat() + "Z",
            'created_by': uid
        }

        if request_data.llm_api_key:
            # APIキー持続時間を取得（デフォルトは24時間）
            duration_hours = request_data.api_key_duration_hours or 24
            key_stored_successfully = api_key_manager.store_room_api_key(
                room_id, request_data.llm_api_key, uid, duration_hours)
            if key_stored_successfully:
                # ルームデータにもAPIキーの期限情報を保存
                api_key_expires_at = (datetime.utcnow() + timedelta(hours=duration_hours)).isoformat() + "Z"
                room_ref.child("apiKeyExpiresAt").set(api_key_expires_at)
                room_ref.child("apiKeyDurationHours").set(duration_hours)
                logger.info(
                    f"Room {room_id} created and LLM API Key stored in room_secrets with {duration_hours}h duration.")
            else:
                logger.warning(
                    f"Room {room_id} created, but LLM API Key could not be stored in room_secrets. Check logs for details.")
        else:
            logger.info(f"Room {room_id} created without LLM API Key.")

        if request_data.llm_models:
            secrets_data['llm_models'] = request_data.llm_models
            room_secrets_ref.update({'llm_models': request_data.llm_models})
            logger.info(
                f"Room {room_id} created and LLM models stored in room_secrets.")
        else:
            logger.info(f"Room {room_id} created without specific LLM models.")

        return {"status": "success", "message": "Room created successfully", "data": new_room_data}
    except Exception as e:
        logger.error(f"Error creating room {room_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to create room: {str(e)}")


class ApproveJoinRequest(BaseModel):
    idToken: str
    roomId: str
    requesterUid: str
    action: str  # "approve" or "reject"


@app.post("/approve_join_request", summary="Approve or reject a join request for a meeting room")
async def approve_join_request_endpoint(request_data: ApproveJoinRequest):
    try:
        decoded_token = firebase_auth.verify_id_token(request_data.idToken)
        owner_uid = decoded_token['uid']

        room_ref = db.reference(f"rooms/{request_data.roomId}")
        room_data = room_ref.get()

        if not room_data:
            raise HTTPException(status_code=404, detail="Room not found.")

        # リクエストを送信したユーザーがルームのオーナーであることを確認
        if room_data.get("owner_uid") != owner_uid:
            raise HTTPException(
                status_code=403, detail="Only the room owner can approve/reject join requests.")

        join_requests_ref = room_ref.child("join_requests")
        requester_request = join_requests_ref.child(
            request_data.requesterUid).get()

        if not requester_request:
            raise HTTPException(
                status_code=404, detail="Join request not found for this user.")

        if request_data.action == "approve":
            # 参加者として追加
            participant_data = {
                "name": requester_request.get("name", f"user_{request_data.requesterUid[:5]}"),
                "role": "Participant",
                "joinedAt": datetime.utcnow().isoformat() + "Z"
            }
            room_ref.child(
                f"participants/{request_data.requesterUid}").set(participant_data)
            # リクエストを削除
            join_requests_ref.child(request_data.requesterUid).delete()
            logger.info(
                f"User {request_data.requesterUid} approved and added to room {request_data.roomId}.")
            return {"status": "success", "message": "User approved and added to participants."}
        elif request_data.action == "reject":
            # リクエストを削除
            join_requests_ref.child(request_data.requesterUid).delete()
            logger.info(
                f"Join request for user {request_data.requesterUid} rejected for room {request_data.roomId}.")
            return {"status": "success", "message": "Join request rejected."}
        else:
            raise HTTPException(
                status_code=400, detail="Invalid action. Must be 'approve' or 'reject'.")

    except Exception as e:
        logger.error(
            f"Error in /approve_join_request for room {request_data.roomId}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Unexpected error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
