from cryptography.fernet import Fernet
import firebase_admin
from datetime import datetime, timedelta
import os
import logging

logger = logging.getLogger(__name__)


class FirebaseAPIKeyManager:
    def __init__(self):
        self.db = firebase_admin.db
        # 将来的にはSecret Managerから取得
        self.encryption_key = os.environ.get('ENCRYPTION_KEY')
        if not self.encryption_key:
            logger.error(
                "ENCRYPTION_KEY environment variable is not set. API key encryption/decryption will fail.")
            # 開発用に一時的なキーを生成することも可能だが、本番ではSecret Managerを使用すべき
            # self.encryption_key = Fernet.generate_key().decode()
            # logger.warning(f"Generated temporary ENCRYPTION_KEY: {self.encryption_key}")
        try:
            self.cipher = Fernet(self.encryption_key.encode())
        except Exception as e:
            logger.error(
                f"Failed to initialize Fernet cipher with provided ENCRYPTION_KEY: {e}")
            self.cipher = None  # 暗号化キーがない場合はcipherをNoneにする

    def store_room_api_key(self, room_id: str, api_key: str, owner_uid: str, ttl_hours: int = 24) -> bool:
        """部屋作成時にAPIキーを暗号化保存"""
        if not self.cipher:
            logger.error(
                "Encryption cipher not initialized. Cannot store API key. Please ensure ENCRYPTION_KEY is set.")
            return False

        logger.info(f"Attempting to store API key for room {room_id}.")
        try:
            encrypted_key = self.cipher.encrypt(api_key.encode()).decode()
            expires_at = (datetime.utcnow() +
                          timedelta(hours=ttl_hours)).isoformat() + "Z"

            ref = self.db.reference(f'room_secrets/{room_id}')
            ref.set({
                'encrypted_api_key': encrypted_key,
                'expires_at': expires_at,
                'created_at': datetime.utcnow().isoformat() + "Z",
                'created_by': owner_uid
            })
            logger.info(
                f"API key for room {room_id} stored successfully in room_secrets.")
            return True
        except Exception as e:
            logger.error(
                f"Error storing API key for room {room_id}: {e}", exc_info=True)
            return False

    def get_room_api_key(self, room_id: str) -> str | None:
        """LLM処理時にAPIキーを復号化取得"""
        if not self.cipher:
            logger.error(
                "Encryption cipher not initialized. Cannot retrieve API key.")
            return None

        ref = self.db.reference(f'room_secrets/{room_id}')
        data = ref.get()

        if not data:
            logger.warning(f"No API key found for room {room_id}.")
            return None

        # 有効期限チェック
        if 'expires_at' in data:
            try:
                # タイムゾーン情報を持つISOフォーマット文字列を正しくパース
                # 'Z' が付いている場合はUTCとして扱う
                expires_dt = datetime.fromisoformat(
                    data['expires_at'].replace('Z', '+00:00'))
                if expires_dt < datetime.utcnow().replace(tzinfo=expires_dt.tzinfo):  # 現在時刻もUTCで比較
                    ref.delete()  # 期限切れなら削除
                    logger.info(
                        f"API key for room {room_id} expired and deleted.")
                    return None
            except ValueError as e:
                logger.error(
                    f"Invalid expires_at format for room {room_id}: {data['expires_at']}. Error: {e}")
                ref.delete()  # 不正なフォーマットの場合は削除
                return None
        else:
            logger.error(
                f"expires_at field missing for room {room_id}. Cannot validate expiry. Deleting key for safety.")
            ref.delete()  # expires_atがない場合は安全のため削除
            return None

        try:
            decrypted_key = self.cipher.decrypt(
                data['encrypted_api_key'].encode()).decode()
            logger.info(
                f"API key for room {room_id} retrieved and decrypted successfully.")
            return decrypted_key
        except Exception as e:
            logger.error(f"Error decrypting API key for room {room_id}: {e}")
            return None

    def cleanup_expired_keys(self):
        """期限切れAPIキーの定期削除（Cloud Schedulerで実行）"""
        ref = self.db.reference('room_secrets')
        secrets = ref.get() or {}

        now_utc = datetime.utcnow()
        expired_rooms = []

        for room_id, data in secrets.items():
            if 'expires_at' in data:
                try:
                    expires_dt = datetime.fromisoformat(
                        data['expires_at'].replace('Z', '+00:00'))
                    if expires_dt < now_utc.replace(tzinfo=expires_dt.tzinfo):
                        expired_rooms.append(room_id)
                except ValueError as e:
                    logger.error(
                        f"Invalid expires_at format for room {room_id} during cleanup: {data['expires_at']}. Error: {e}")
                    expired_rooms.append(room_id)  # 不正なフォーマットも削除対象に含める
            else:
                logger.warning(
                    f"expires_at field missing for room {room_id} during cleanup. Deleting key for safety.")
                expired_rooms.append(room_id)  # expires_atがない場合は安全のため削除

        # バッチ削除
        for room_id in expired_rooms:
            ref.child(room_id).delete()
            logger.info(f"Cleaned up expired API key for room {room_id}.")

    def delete_room_api_key(self, room_id: str):
        """部屋削除時のAPIキー削除"""
        ref = self.db.reference(f'room_secrets/{room_id}')
        ref.delete()
        logger.info(f"API key for room {room_id} deleted.")


# Global instance for use in main.py
_api_key_manager = None


def get_api_key_manager():
    """Get the global API key manager instance"""
    global _api_key_manager
    if _api_key_manager is None:
        _api_key_manager = FirebaseAPIKeyManager()
    return _api_key_manager


async def get_llm_api_key(room_id: str) -> str | None:
    """Get LLM API key for a room (async wrapper for compatibility)"""
    manager = get_api_key_manager()
    return manager.get_room_api_key(room_id)
