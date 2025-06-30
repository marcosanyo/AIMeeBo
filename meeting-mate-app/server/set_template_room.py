import firebase_admin
from firebase_admin import credentials, db
import os
import json
from dotenv import load_dotenv

load_dotenv()

try:
    database_url = os.getenv('FIREBASE_DATABASE_URL')
    if not database_url:
        gcp_project_id = os.getenv('GCP_PROJECT_ID')
        if gcp_project_id:
            database_url = f"https://{gcp_project_id}-default-rtdb.firebaseio.com"
            print(f"FIREBASE_DATABASE_URL inferred: {database_url}")
        else:
            raise ValueError(
                "FIREBASE_DATABASE_URL and GCP_PROJECT_ID not set.")

    # Firebase Admin SDKの初期化（既に初期化されている場合はスキップ）
    if not firebase_admin._apps:
        # サービスアカウントキーファイルのパスを取得
        # 環境変数 GOOGLE_APPLICATION_CREDENTIALS が設定されていることを想定
        cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if not cred_path or not os.path.exists(cred_path):
            # もし環境変数がない場合、特定のパスを試す（例: /workspaces/meeting-mate/sa-vertex-functions.json）
            # これは環境に依存するため、ユーザーに確認するか、より汎用的な方法を検討する必要があるかもしれません。
            # 今回は、環境変数があることを前提とします。
            print(
                "GOOGLE_APPLICATION_CREDENTIALS environment variable not set or file not found.")
            # エラーとして扱うか、別の認証方法を試すか検討
            # ここではエラーとして終了します
            exit(1)

        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {'databaseURL': database_url})
        print("Firebase Admin SDK initialized.")
    else:
        print("Firebase Admin SDK already initialized.")

    # templateルームの空データ構造
    empty_template_room_data = {
        "sessionId": "template-session",
        "sessionTitle": "テンプレートルーム",
        "startTime": "",
        "ownerId": "",
        "participants": {},
        "tasks": [],
        "notes": [],
        "overviewDiagram": {
            "title": "会議の概要図",
            "mermaidDefinition": "graph TD;\nA[会議開始];"
        },
        "currentAgenda": {
            "mainTopic": "会議開始",
            "details": []
        },
        "suggestedNextTopics": [],
        "transcript": [],
        "last_llm_processed_message_count": 0,
        "representativeMode": False
    }

    # rooms/template パスにデータを書き込む
    template_room_ref = db.reference("rooms/template")
    template_room_ref.set(empty_template_room_data)

    print("Empty template room data successfully written to Firebase Realtime Database at rooms/template.")

except Exception as e:
    print(f"Error writing template room data to Firebase: {e}")
    exit(1)
