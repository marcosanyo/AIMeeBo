# For forward references in Pydantic models if needed
from __future__ import annotations
from pydantic import BaseModel
# Changed from list, dict to List, Dict, Optional, Any
from typing import List, Optional, Dict, Any

# Fallback basic Pydantic models if a2a-sdk is not fully available


class A2APart(BaseModel):
    text: Optional[str] = None  # Changed to Optional[str]


class Message(BaseModel):
    role: str  # "user" or "agent"
    parts: List[A2APart]


class Task(BaseModel):
    taskId: str
    contextId: Optional[str] = None
    messages: List[Message] = []


class AgentSkill(BaseModel):
    id: str
    name: str
    description: str
    tags: List[str] = []
    examples: List[str] = []
    inputModes: List[str] = ["text"]
    outputModes: List[str] = ["text"]


class AgentCapabilities(BaseModel):
    streaming: bool = False
    pushNotifications: bool = False
    stateTransitionHistory: bool = False


class AgentCard(BaseModel):
    name: str
    description: str
    url: str
    version: str = "0.1.0"
    defaultInputModes: List[str] = ["text"]
    defaultOutputModes: List[str] = ["text"]
    capabilities: AgentCapabilities
    skills: List[AgentSkill]


class JsonRpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    # Changed to use Dict and List from typing
    params: Optional[Dict[str, Any] | List[Any]] = None
    id: Optional[int | str] = None


class JsonRpcResponse(BaseModel):
    jsonrpc: str = "2.0"
    result: Optional[AgentResult] = None
    error: Optional[Dict[str, Any]] = None  # Changed to use Dict from typing
    id: Optional[int | str] = None


class CreateRoomRequest(BaseModel):
    room_id: str
    room_name: str


# Models for meeting-mate data structure

class NoteItem(BaseModel):
    id: str
    type: str  # "memo", "decision", "issue"
    text: str
    # timestamp: str # Removed as per user request


class TodoItem(BaseModel):
    id: str
    title: str
    assignee: Optional[str] = None
    dueDate: Optional[str] = None
    status: str  # "todo", "doing", "done"
    detail: Optional[str] = None


class Participant(BaseModel):
    name: str
    role: str
    joinedAt: Optional[str] = None


class OverviewDiagram(BaseModel):
    mermaidDefinition: str
    title: str


class CurrentAgenda(BaseModel):
    mainTopic: str
    details: List[Any] = []  # Assuming details can be flexible for now


class RoomData(BaseModel):
    sessionId: str
    sessionTitle: str
    startTime: str
    participants: Dict[str, Participant]
    agenda: List[Any] = []  # Assuming agenda can be flexible
    tasks: List[TodoItem]
    overviewDiagram: OverviewDiagram
    notes: List[NoteItem]
    transcript: List[Any] = []  # Assuming transcript can be flexible
    currentAgenda: CurrentAgenda
    suggestedNextTopics: List[str]
    currentTopic: Optional[str] = None
    suggestedNextTopic: Optional[str] = None


class SessionData(BaseModel):
    rooms: Dict[str, RoomData]
    participants: List[Participant]  # Root level participants
    currentAgenda: CurrentAgenda
    suggestedNextTopics: List[str]
    overviewDiagram: OverviewDiagram


# Additional models for main.py functionality

class LLMMessage(BaseModel):
    role: str  # "user", "model", "ai"
    parts: List[Dict[str, str]]  # [{"text": "message content"}]


class DBTranscriptEntry(BaseModel):
    text: str
    userId: str
    userName: str
    timestamp: str
    role: str  # "user" or "ai"


class TaskPayload(BaseModel):
    roomId: str
    speakerId: str
    speakerName: str
    messages: List[LLMMessage] = []


class AgentResult(BaseModel):
    invokedAgents: List[str] = []
    updatedTasks: List[TodoItem] = []
