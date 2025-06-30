import firebase_admin
from firebase_admin import credentials, db
import os
from typing import Dict, Any, Optional
from config import logger
import json  # jsonをインポート

# 汎用的なJSON操作関数を追加


def ensure_dir_exists(path: str):
    """指定されたパスのディレクトリが存在することを確認し、なければ作成する。"""
    if not os.path.exists(path):
        os.makedirs(path)
        logger.info(f"Created directory: {path}")


def load_json(file_path: str) -> Optional[Dict[str, Any]]:
    """指定されたパスからJSONファイルを読み込む。"""
    try:
        if not os.path.exists(file_path):
            logger.warning(f"JSON file not found at {file_path}")
            return None
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(
            f"Error loading JSON from {file_path}: {e}", exc_info=True)
        return None


def save_json(data: Dict[str, Any], file_path: str):
    """指定されたパスにデータをJSONファイルとして保存する。"""
    try:
        ensure_dir_exists(os.path.dirname(file_path))
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        logger.info(f"Data saved to JSON file: {file_path}")
    except Exception as e:
        logger.error(f"Error saving JSON to {file_path}: {e}", exc_info=True)


# Firebase Admin SDKの初期化
# GOOGLE_APPLICATION_CREDENTIALS環境変数が設定されていれば、自動的に認証情報が使用される
# DATABASE_URLは環境変数から取得するか、直接指定する
try:
    FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL")
    if not FIREBASE_DATABASE_URL:
        logger.warning(
            "FIREBASE_DATABASE_URL is not set. Firebase Admin SDK might not work correctly.")
        # ローカル開発用にフォールバックURLを設定することも可能だが、本番では環境変数設定を推奨
        # FIREBASE_DATABASE_URL = "https://your-project-id.firebaseio.com" # 例

    # credentials.ApplicationDefault() は GOOGLE_APPLICATION_CREDENTIALS を自動で探す
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'databaseURL': FIREBASE_DATABASE_URL
    })
    logger.info("Firebase Admin SDK initialized successfully.")
except Exception as e:
    logger.error(f"Error initializing Firebase Admin SDK: {e}", exc_info=True)
    # SDK初期化失敗時は、以降のDB操作が失敗する可能性があることを警告


DEFAULT_ROOM_STRUCTURE = {
    "participants": {},
    "transcript": {},  # Firebaseではリストよりオブジェクトを推奨
    "tasks": {},      # 同上
    "notes": {},      # 同上
    "overviewDiagram": {"title": "概要図", "mermaidDefinition": "graph TD;\nA[開始];"},
    "currentAgenda": {"mainTopic": "会議開始", "details": {}},  # 同上
    "suggestedNextTopics": {},  # 同上
    "full_transcript_history": {},  # 同上
    "sessionTitle": "Untitled Session",
    "sessionId": "",  # room_idで代用または別途生成
    "startTime": ""  # ISO 8601形式のタイムスタンプ
}


def load_session_data(room_id: str) -> Optional[Dict[str, Any]]:
    """
    指定されたroom_idのセッションデータをFirebase Realtime Databaseから読み込む。
    ルームが存在しない場合は、デフォルト構造で新しいルームを作成して返す。
    """
    if not firebase_admin._apps:
        logger.error("Firebase Admin SDK not initialized. Cannot load data.")
        return None
    try:
        ref = db.reference(f'/rooms/{room_id}')
        room_data = ref.get()

        if room_data is None:
            logger.warning(
                f"Room '{room_id}' not found in Firebase. Creating with default structure.")
            # デフォルト構造にroom_id固有の情報を追加
            new_room_data = DEFAULT_ROOM_STRUCTURE.copy()
            new_room_data["sessionId"] = room_id  # sessionIdとしてroom_idを使用
            # new_room_data["startTime"] = datetime.utcnow().isoformat() + "Z" # 必要に応じて開始時刻を設定
            ref.set(new_room_data)
            return new_room_data
        else:
            # 既存データにデフォルトキーが不足している場合、補完する
            updated = False
            for key, default_value in DEFAULT_ROOM_STRUCTURE.items():
                if key not in room_data:
                    logger.warning(
                        f"Key '{key}' missing in room '{room_id}'. Initializing with default.")
                    room_data[key] = default_value
                    updated = True
            # if updated:
            #     # キーが不足していた場合、補完したデータでDBを更新する処理を一旦コメントアウト
            #     # この処理が意図しないデータ上書きを引き起こす可能性があるため。
            #     # 必要であれば、呼び出し元で明示的に保存処理を行うべき。
            #     logger.info(f"Room '{room_id}' data was missing keys, default values added. DB update skipped in load_session_data.")
            #     # save_session_data(room_data, room_id)
            return room_data

    except Exception as e:
        logger.error(
            f"Unexpected error loading session data for room '{room_id}' from Firebase: {e}", exc_info=True)
        return None


def save_session_data(data_to_save: Dict[str, Any], room_id: str):
    """
    指定されたroom_idのセッションデータをFirebase Realtime Databaseに保存する。
    """
    if not firebase_admin._apps:
        logger.error("Firebase Admin SDK not initialized. Cannot save data.")
        return
    try:
        ref = db.reference(f'/rooms/{room_id}')
        ref.set(data_to_save)
        logger.info(
            f"Session data for room '{room_id}' saved to Firebase Realtime Database.")

    except Exception as e:
        logger.error(
            f"Unexpected error saving session data for room '{room_id}' to Firebase: {e}", exc_info=True)

# `load_all_session_data` はFirebaseでは通常不要。必要なら `db.reference('/rooms').get()` を使用。


if __name__ == '__main__':
    # Firebase Admin SDKの初期化をここでも行うか、環境変数経由で確実に行う必要がある
    # このテストを実行する前に、GOOGLE_APPLICATION_CREDENTIALS と FIREBASE_DATABASE_URL を設定してください。
    if not firebase_admin._apps:
        print("Firebase Admin SDK not initialized. Please set GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_DATABASE_URL.")
    else:
        logger.info("Testing file_utils.py with Firebase...")
        test_room_id = "test_firebase_room_123"

        # 1. Load data (room might not exist, should be created)
        logger.info(f"Attempting to load data for room: {test_room_id}")
        loaded_data = load_session_data(test_room_id)
        if loaded_data:
            logger.info(
                f"Loaded data for {test_room_id}: {loaded_data}")

            # 2. Modify some data
            if "tasks" not in loaded_data or not isinstance(loaded_data["tasks"], dict):
                loaded_data["tasks"] = {}  # Firebaseではオブジェクト形式

            # Firebaseではpush()でユニークIDを生成するか、固定IDを使用
            new_task_id = db.reference(
                f'/rooms/{test_room_id}/tasks').push().key
            if new_task_id:
                loaded_data["tasks"][new_task_id] = {
                    "title": "Test Firebase Task", "status": "未着手"}
                logger.info(f"Added new task with ID: {new_task_id}")
            else:
                logger.error("Failed to generate new task ID.")

            # 3. Save data
            logger.info(f"Attempting to save data for room: {test_room_id}")
            save_session_data(loaded_data, test_room_id)
            logger.info(f"Data for {test_room_id} saved.")

            # 4. Reload data to verify
            logger.info(f"Attempting to reload data for room: {test_room_id}")
            reloaded_data = load_session_data(test_room_id)
            if reloaded_data:
                logger.info(
                    f"Reloaded data for {test_room_id}: {reloaded_data}")

                task_found = False
                if "tasks" in reloaded_data and isinstance(reloaded_data["tasks"], dict):
                    for task_id, task_details in reloaded_data["tasks"].items():
                        if task_details.get("title") == "Test Firebase Task":
                            task_found = True
                            logger.info(
                                f"Test task found in reloaded data with ID: {task_id}")
                            break

                if task_found:
                    logger.info(
                        "Firebase save and load seem to work for tasks.")
                else:
                    logger.error(
                        "Test task NOT found in reloaded Firebase data.")
            else:
                logger.error(f"Failed to reload data for {test_room_id}")
        else:
            logger.error(f"Failed to load or create data for {test_room_id}")

        # Clean up the test room (optional)
        # try:
        #     db.reference(f'/rooms/{test_room_id}').delete()
        #     logger.info(f"Test room '{test_room_id}' deleted from Firebase.")
        # except Exception as e:
        #     logger.error(f"Error deleting test room '{test_room_id}': {e}")
