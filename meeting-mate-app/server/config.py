import logging
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("meeting_mate_server")

# Vertex AI Configuration
# Use original environment variable names as provided by the user
PROJECT_ID = os.environ.get("PROJECT_ID")
REGION = os.environ.get("REGION")
# VERTEX_MODEL_NAME is used in main.py, ensure it's defined.
# User's original code used LLM_MODEL for this.
VERTEX_MODEL_NAME = os.environ.get(
    "LLM_MODEL", "gemini-2.5-flash")  # Default if LLM_MODEL not set

VERTEX_AI_AVAILABLE = False
try:
    if PROJECT_ID and REGION and VERTEX_MODEL_NAME:
        import vertexai
        # Ensure this can be imported if we init
        from vertexai.generative_models import GenerativeModel
        # vertexai.init(project=PROJECT_ID, location=REGION) # main.pyでリクエストごとに初期化するため削除
        logger.info(
            f"Vertex AI configuration loaded: Project {PROJECT_ID}, Location {REGION}, Model {VERTEX_MODEL_NAME}")
        VERTEX_AI_AVAILABLE = True
    else:
        logger.warning(
            "Vertex AI Project ID, Location, or Model Name not fully configured in .env. "
            "Required: PROJECT_ID, REGION, LLM_MODEL. LLM features may be limited."
        )
except ImportError:
    logger.warning(
        "google-cloud-aiplatform library not found. Vertex AI features will be disabled.")
except Exception as e:
    logger.error(
        f"Vertex AI module import or initial check failed in config: {e}")


# Firebase Configuration
FIREBASE_DATABASE_URL = os.environ.get("FIREBASE_DATABASE_URL")
FIREBASE_CREDENTIALS_PATH = os.environ.get(
    # Keep this as it was in my version
    "FIREBASE_CREDENTIALS_PATH", "./sa-vertex-functions.json")

if not FIREBASE_DATABASE_URL:
    logger.warning(
        "FIREBASE_DATABASE_URL environment variable is not set. Database operations will fail.")

# LLM Orchestrator (New setting, keep it)
LLM_ORCHESTRATOR_MODEL_NAME = os.getenv(
    "LLM_ORCHESTRATOR_MODEL_NAME", "gemini-2.5-flash")

# Number of messages to trigger LLM processing (New setting, keep it)
LLM_TRIGGER_MESSAGE_COUNT = int(os.getenv("LLM_TRIGGER_MESSAGE_COUNT", 3))


# Agent Configuration (Taken from user's original code)
# Assumes agent config JSON files are in a subdirectory named 'agent_configs' within the 'server' directory
# Ensure AGENT_CONFIG_DIR is defined if used elsewhere, or remove if not.
# For now, let's assume it might be used by agent initializations in main.py
AGENT_CONFIG_DIR = os.path.join(os.path.dirname(__file__), "agent_configs")
if not os.path.exists(AGENT_CONFIG_DIR):
    # Fallback if 'agent_configs' does not exist, to prevent errors if agents are initialized using it.
    # This path might need adjustment based on actual project structure if agents are outside 'server'.
    # Assuming agents are within 'server/agents' and configs are 'server/agent_configs'
    alt_agent_config_dir = os.path.join(
        os.path.dirname(__file__), "agents")  # A common pattern
    # server/agents/agent_configs
    if os.path.exists(os.path.join(alt_agent_config_dir, "agent_configs")):
        AGENT_CONFIG_DIR = os.path.join(alt_agent_config_dir, "agent_configs")
    # If server/agent_configs still not found
    elif not os.path.exists(AGENT_CONFIG_DIR):
        logger.warning(
            f"Agent config directory {AGENT_CONFIG_DIR} not found. Agent loading might fail.")
        # Create a dummy one to prevent crash if path is used but files are missing
        try:
            os.makedirs(AGENT_CONFIG_DIR, exist_ok=True)
            logger.info(
                f"Created dummy agent_configs directory at {AGENT_CONFIG_DIR}")
        except Exception as e:
            logger.error(
                f"Could not create dummy agent_configs directory: {e}")


MAX_ITERATIONS = int(os.environ.get("MAX_ITERATIONS", 5))
MAX_RETRY_ATTEMPTS = int(os.environ.get("MAX_RETRY_ATTEMPTS", 3))


# This check replaces the stricter one that caused the ValueError
if not all([PROJECT_ID, REGION, FIREBASE_DATABASE_URL]):
    logger.warning(
        "One or more critical environment variables (PROJECT_ID, REGION, FIREBASE_DATABASE_URL) are not set. "
        "Application functionality will be severely limited."
    )


if __name__ == '__main__':
    logger.info(f"Config loaded. VERTEX_AI_AVAILABLE: {VERTEX_AI_AVAILABLE}")
    logger.info(f"Firebase Database URL (from env): {FIREBASE_DATABASE_URL}")
    logger.info(f"LLM Trigger Message Count: {LLM_TRIGGER_MESSAGE_COUNT}")
    logger.info(f"LLM Orchestrator Model Name: {LLM_ORCHESTRATOR_MODEL_NAME}")
    if VERTEX_AI_AVAILABLE:
        try:
            from vertexai.generative_models import GenerativeModel
            model = GenerativeModel(VERTEX_MODEL_NAME)
            logger.info(
                f"Successfully instantiated Vertex AI model in config test: {VERTEX_MODEL_NAME}")
        except Exception as e:
            logger.error(
                f"Failed to instantiate Vertex AI model in config test: {e}")
