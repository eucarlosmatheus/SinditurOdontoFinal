from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
import base64
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
import socketio
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'dental_clinic')]

# JWT Settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'dental-clinic-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Brazil timezone (UTC-3)
BRT = timezone(timedelta(hours=-3))

# ==================== SOCKET.IO SETUP ====================
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Create the main FastAPI app
fastapi_app = FastAPI(title="Dental Clinic API")

# Create routers
api_router = APIRouter(prefix="/api")
admin_router = APIRouter(prefix="/api/admin")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

# Patient Models
class UserRegister(BaseModel):
    name: str
    cpf: str
    birth_date: str

class UserLogin(BaseModel):
    cpf: str
    birth_date: str

class UserResponse(BaseModel):
    id: str
    name: str
    cpf: str
    birth_date: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    gender: Optional[str] = ""
    associate: Optional[str] = ""
    company: Optional[str] = ""
    created_at: datetime

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    associate: Optional[str] = None
    company: Optional[str] = None
    birth_date: Optional[str] = None

# Staff Models
class StaffCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str  # admin, manager, receptionist, doctor
    permissions: List[str] = []

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    active: Optional[bool] = None

class StaffLogin(BaseModel):
    email: str
    password: str

class StaffResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    permissions: List[str]
    active: bool
    created_at: datetime

# Unit Models
class UnitCreate(BaseModel):
    name: str
    address: str
    phone: Optional[str] = ""

class UnitUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None

class Unit(BaseModel):
    id: str
    name: str
    address: str
    phone: Optional[str] = ""

# Service Models
class ServiceCreate(BaseModel):
    name: str
    description: str
    duration_minutes: int
    price: float = 0.0

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = None

class Service(BaseModel):
    id: str
    name: str
    description: str
    duration_minutes: int
    price: Optional[float] = 0.0

# Doctor Models
class DoctorCreate(BaseModel):
    name: str
    specialty: str
    unit_id: str
    cro: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    photo_base64: Optional[str] = None
    bio: str = ""
    available_days: List[str] = []

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    unit_id: Optional[str] = None
    cro: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_base64: Optional[str] = None
    bio: Optional[str] = None
    available_days: Optional[List[str]] = None

class Doctor(BaseModel):
    id: str
    name: str
    specialty: str
    unit_id: str
    cro: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    photo_base64: Optional[str] = None
    bio: str
    available_days: List[str]

# Appointment Models
class AppointmentCreate(BaseModel):
    unit_id: str
    service_id: str
    doctor_id: str
    date: str
    time: str
    notes: Optional[str] = ""

class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    paid_value: Optional[float] = None

class AppointmentResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = ""
    user_cpf: Optional[str] = ""
    unit_id: str
    unit_name: str
    service_id: str
    service_name: str
    service_price: Optional[float] = 0.0
    doctor_id: str
    doctor_name: str
    date: str
    time: str
    status: str
    notes: str
    paid_value: Optional[float] = 0.0
    created_at: datetime

# Inventory Models
class InventoryItemCreate(BaseModel):
    name: str
    quantity: int
    unit: str  # unidade, caixa, pacote, etc
    min_quantity: int = 0

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    min_quantity: Optional[int] = None

class InventoryMovement(BaseModel):
    item_id: str
    type: str  # entrada, saida
    quantity: int
    doctor_id: Optional[str] = None
    notes: Optional[str] = ""

# Document Template Models
class DocumentTemplateUpdate(BaseModel):
    content: str

class DocumentGenerate(BaseModel):
    template_type: str  # atestado, afastamento, termo_consentimento, receita
    patient_id: str
    doctor_id: str
    custom_fields: Optional[dict] = {}

# Token Response
class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

# ==================== HELPER FUNCTIONS ====================

def serialize_doc(doc):
    """Remove MongoDB _id field for JSON serialization"""
    if doc is None:
        return None
    return {k: v for k, v in doc.items() if k != '_id'}

def serialize_docs(docs):
    """Remove MongoDB _id field from a list of documents"""
    return [serialize_doc(d) for d in docs]

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        user_type: str = payload.get("type", "patient")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    if user_type == "staff":
        user = await db.staff.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user["user_type"] = "staff"
    else:
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user["user_type"] = "patient"
    
    return user

async def get_staff_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if user.get("user_type") != "staff":
        raise HTTPException(status_code=403, detail="Acesso negado")
    return user

def get_brazil_now():
    """Get current time in Brazil (UTC-3)"""
    return datetime.now(BRT)

def parse_br_date(date_str):
    """Parse DD/MM/YYYY to datetime"""
    try:
        parts = date_str.split("/")
        return datetime(int(parts[2]), int(parts[1]), int(parts[0]), tzinfo=BRT)
    except Exception:
        return None

# ==================== SOCKET.IO EVENTS ====================

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_admin(sid, data):
    """Admin panel joins the admin room"""
    await sio.enter_room(sid, 'admin')
    logger.info(f"Admin joined: {sid}")

@sio.event
async def join_patient(sid, data):
    """Patient joins their personal room"""
    user_id = data.get('user_id')
    if user_id:
        await sio.enter_room(sid, f'patient_{user_id}')
        logger.info(f"Patient joined: {sid} -> room patient_{user_id}")

async def emit_to_admin(event, data):
    """Emit event to all admin panel clients"""
    try:
        await sio.emit(event, data, room='admin')
    except Exception as e:
        logger.error(f"Error emitting to admin: {e}")

async def emit_to_patient(user_id, event, data):
    """Emit event to a specific patient"""
    try:
        await sio.emit(event, data, room=f'patient_{user_id}')
    except Exception as e:
        logger.error(f"Error emitting to patient: {e}")

# ==================== SEED DATA ====================

DEFAULT_DOCUMENT_TEMPLATES = {
    "atestado": """ATESTADO ODONTOLÓGICO

Atesto para os devidos fins que o(a) paciente {NOME_PACIENTE}, portador(a) do CPF {CPF_PACIENTE}, compareceu a esta clínica odontológica na data de {DATA} para realização de procedimento odontológico, necessitando de afastamento de suas atividades por {DIAS_AFASTAMENTO} dia(s).

{CIDADE}, {DATA_EXTENSO}

_________________________________
{NOME_DOUTOR}
CRO: {CRO_DOUTOR}
{NOME_CLINICA}""",

    "afastamento": """DECLARAÇÃO DE AFASTAMENTO

Declaro para os devidos fins que o(a) paciente {NOME_PACIENTE}, portador(a) do CPF {CPF_PACIENTE}, está em tratamento odontológico nesta clínica desde {DATA_INICIO} com previsão de término em {DATA_FIM}.

Durante este período, o paciente necessita de afastamento de suas atividades laborais para realização dos procedimentos necessários.

Procedimentos: {PROCEDIMENTOS}

{CIDADE}, {DATA_EXTENSO}

_________________________________
{NOME_DOUTOR}
CRO: {CRO_DOUTOR}
{NOME_CLINICA}""",

    "termo_consentimento": """TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO

Eu, {NOME_PACIENTE}, portador(a) do CPF {CPF_PACIENTE}, declaro que fui devidamente informado(a) pelo(a) Dr(a). {NOME_DOUTOR}, CRO {CRO_DOUTOR}, sobre o procedimento de {PROCEDIMENTO} a ser realizado.

Declaro que:
1. Fui informado(a) sobre os riscos e benefícios do procedimento;
2. Tive a oportunidade de fazer perguntas e todas foram respondidas satisfatoriamente;
3. Compreendi as instruções pré e pós-operatórias;
4. Autorizo a realização do procedimento proposto;
5. Autorizo o uso de imagens para fins didáticos e científicos, preservando minha identidade.

{CIDADE}, {DATA_EXTENSO}

_________________________________
{NOME_PACIENTE}
Paciente

_________________________________
{NOME_DOUTOR}
CRO: {CRO_DOUTOR}""",

    "receita": """RECEITUÁRIO

Paciente: {NOME_PACIENTE}
CPF: {CPF_PACIENTE}
Data: {DATA}

PRESCRIÇÃO:

{MEDICAMENTOS}

Observações: {OBSERVACOES}

_________________________________
{NOME_DOUTOR}
CRO: {CRO_DOUTOR}
{NOME_CLINICA}
{ENDERECO_CLINICA}"""
}

async def seed_data():
    """Seed initial data"""
    
    # Check if data already exists
    units_count = await db.units.count_documents({})
    if units_count > 0:
        logger.info("Data already seeded")
        # Still ensure we have document templates
        await ensure_document_templates()
        await ensure_admin_user()
        return
    
    # Units
    units = [
        {"id": "unit-1", "name": "Unidade Sinditur - Flores", "address": "Rua das Flores, 123 - Flores", "phone": "(92) 3333-1111"},
        {"id": "unit-2", "name": "Unidade Centro", "address": "Av. Central, 456 - Centro", "phone": "(92) 3333-2222"}
    ]
    await db.units.insert_many(units)
    
    # Services with prices
    services = [
        {"id": "service-1", "name": "Limpeza Dental", "description": "Limpeza completa dos dentes e gengivas", "duration_minutes": 30, "price": 150.00},
        {"id": "service-2", "name": "Clareamento", "description": "Clareamento dental profissional", "duration_minutes": 60, "price": 500.00},
        {"id": "service-3", "name": "Restauração", "description": "Restauração dentária com resina", "duration_minutes": 45, "price": 200.00},
        {"id": "service-4", "name": "Ortodontia", "description": "Consulta e acompanhamento ortodôntico", "duration_minutes": 30, "price": 180.00},
        {"id": "service-5", "name": "Extração", "description": "Extração de dente simples", "duration_minutes": 45, "price": 250.00},
        {"id": "service-6", "name": "Canal", "description": "Tratamento de canal dentário", "duration_minutes": 90, "price": 600.00},
        {"id": "service-7", "name": "Consulta Avaliação", "description": "Consulta inicial de avaliação", "duration_minutes": 30, "price": 100.00}
    ]
    await db.services.insert_many(services)
    
    # Doctors with CRO
    doctors = [
        {"id": "doctor-1", "name": "Dr. Carlos Silva", "specialty": "Clínico Geral", "unit_id": "unit-1", "cro": "AM-12345", "phone": "(92) 99999-1111", "email": "carlos@odonto.com", "photo_base64": None, "bio": "10 anos de experiência em odontologia geral", "available_days": ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]},
        {"id": "doctor-2", "name": "Dra. Ana Santos", "specialty": "Ortodontista", "unit_id": "unit-1", "cro": "AM-12346", "phone": "(92) 99999-2222", "email": "ana@odonto.com", "photo_base64": None, "bio": "Especialista em aparelhos ortodônticos", "available_days": ["Segunda", "Quarta", "Sexta"]},
        {"id": "doctor-3", "name": "Dr. Pedro Oliveira", "specialty": "Endodontista", "unit_id": "unit-2", "cro": "AM-12347", "phone": "(92) 99999-3333", "email": "pedro@odonto.com", "photo_base64": None, "bio": "Especialista em tratamento de canal", "available_days": ["Terça", "Quinta", "Sexta"]},
        {"id": "doctor-4", "name": "Dra. Maria Costa", "specialty": "Clínico Geral", "unit_id": "unit-2", "cro": "AM-12348", "phone": "(92) 99999-4444", "email": "maria@odonto.com", "photo_base64": None, "bio": "8 anos de experiência em procedimentos estéticos", "available_days": ["Segunda", "Terça", "Quarta", "Quinta"]}
    ]
    await db.doctors.insert_many(doctors)
    
    await ensure_document_templates()
    await ensure_admin_user()
    
    logger.info("Data seeded successfully")

async def ensure_document_templates():
    """Ensure document templates exist"""
    for template_type, content in DEFAULT_DOCUMENT_TEMPLATES.items():
        existing = await db.document_templates.find_one({"type": template_type})
        if not existing:
            await db.document_templates.insert_one({
                "id": str(uuid.uuid4()),
                "type": template_type,
                "content": content,
                "updated_at": datetime.utcnow()
            })

async def ensure_admin_user():
    """Ensure admin user exists"""
    admin = await db.staff.find_one({"email": "admin@odonto.com"})
    if not admin:
        await db.staff.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Administrador",
            "email": "admin@odonto.com",
            "password": get_password_hash("admin123"),
            "role": "admin",
            "permissions": ["all"],
            "active": True,
            "created_at": datetime.utcnow()
        })
        logger.info("Admin user created: admin@odonto.com / admin123")

# ==================== PATIENT AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    existing_cpf = await db.users.find_one({"cpf": user_data.cpf})
    if existing_cpf:
        raise HTTPException(status_code=400, detail="CPF já cadastrado")
    
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "name": user_data.name,
        "cpf": user_data.cpf,
        "birth_date": user_data.birth_date,
        "phone": "",
        "address": "",
        "gender": "",
        "associate": "",
        "company": "",
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user_dict)
    
    access_token = create_access_token(data={"sub": user_id, "type": "patient"})
    
    # Emit real-time event to admin
    await emit_to_admin('new_patient', {
        "id": user_id,
        "name": user_data.name,
        "cpf": user_data.cpf,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(**user_dict)
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"cpf": credentials.cpf, "birth_date": credentials.birth_date})
    if not user:
        raise HTTPException(status_code=401, detail="CPF ou data de nascimento inválidos")
    
    access_token = create_access_token(data={"sub": user["id"], "type": "patient"})
    
    user_resp = {
        "id": user["id"],
        "name": user["name"],
        "cpf": user["cpf"],
        "birth_date": user["birth_date"],
        "phone": user.get("phone", ""),
        "address": user.get("address", ""),
        "gender": user.get("gender", ""),
        "associate": user.get("associate", ""),
        "company": user.get("company", ""),
        "created_at": user["created_at"]
    }
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(**user_resp)
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") == "staff":
        return StaffResponse(**{k: current_user[k] for k in ["id", "name", "email", "role", "permissions", "active", "created_at"]})
    return UserResponse(**{
        "id": current_user["id"],
        "name": current_user["name"],
        "cpf": current_user["cpf"],
        "birth_date": current_user["birth_date"],
        "phone": current_user.get("phone", ""),
        "address": current_user.get("address", ""),
        "gender": current_user.get("gender", ""),
        "associate": current_user.get("associate", ""),
        "company": current_user.get("company", ""),
        "created_at": current_user["created_at"]
    })

# ==================== STAFF AUTH ROUTES ====================

@admin_router.post("/auth/login")
async def staff_login(credentials: StaffLogin):
    staff = await db.staff.find_one({"email": credentials.email})
    if not staff or not verify_password(credentials.password, staff["password"]):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    
    if not staff.get("active", True):
        raise HTTPException(status_code=401, detail="Usuário inativo")
    
    access_token = create_access_token(data={"sub": staff["id"], "type": "staff"})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": StaffResponse(**{k: staff[k] for k in ["id", "name", "email", "role", "permissions", "active", "created_at"]})
    }

# ==================== STAFF MANAGEMENT ROUTES ====================

@admin_router.get("/staff")
async def get_all_staff(current_user: dict = Depends(get_staff_user)):
    staff_list = await db.staff.find().to_list(100)
    return [StaffResponse(**{k: s[k] for k in ["id", "name", "email", "role", "permissions", "active", "created_at"]}) for s in staff_list]

@admin_router.post("/staff")
async def create_staff(staff_data: StaffCreate, current_user: dict = Depends(get_staff_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem criar colaboradores")
    
    existing = await db.staff.find_one({"email": staff_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    staff_id = str(uuid.uuid4())
    staff_dict = {
        "id": staff_id,
        "name": staff_data.name,
        "email": staff_data.email,
        "password": get_password_hash(staff_data.password),
        "role": staff_data.role,
        "permissions": staff_data.permissions,
        "active": True,
        "created_at": datetime.utcnow()
    }
    await db.staff.insert_one(staff_dict)
    
    return StaffResponse(**{k: staff_dict[k] for k in ["id", "name", "email", "role", "permissions", "active", "created_at"]})

@admin_router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, staff_data: StaffUpdate, current_user: dict = Depends(get_staff_user)):
    if current_user.get("role") != "admin" and current_user.get("id") != staff_id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    update_dict = {k: v for k, v in staff_data.dict().items() if v is not None}
    if "password" in update_dict:
        update_dict["password"] = get_password_hash(update_dict["password"])
    
    if update_dict:
        await db.staff.update_one({"id": staff_id}, {"$set": update_dict})
    
    staff = await db.staff.find_one({"id": staff_id})
    return StaffResponse(**{k: staff[k] for k in ["id", "name", "email", "role", "permissions", "active", "created_at"]})

@admin_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, current_user: dict = Depends(get_staff_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem remover colaboradores")
    
    await db.staff.delete_one({"id": staff_id})
    return {"message": "Colaborador removido"}

# ==================== UNITS ROUTES ====================

@api_router.get("/units")
async def get_units():
    units = await db.units.find().to_list(100)
    return [Unit(**u) for u in units]

@admin_router.post("/units")
async def create_unit(unit_data: UnitCreate, current_user: dict = Depends(get_staff_user)):
    unit_id = str(uuid.uuid4())
    unit_dict = {"id": unit_id, **unit_data.dict()}
    await db.units.insert_one(unit_dict)
    return Unit(**unit_dict)

@admin_router.put("/units/{unit_id}")
async def update_unit(unit_id: str, unit_data: UnitUpdate, current_user: dict = Depends(get_staff_user)):
    update_dict = {k: v for k, v in unit_data.dict().items() if v is not None}
    if update_dict:
        await db.units.update_one({"id": unit_id}, {"$set": update_dict})
    unit = await db.units.find_one({"id": unit_id})
    return Unit(**unit)

@admin_router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, current_user: dict = Depends(get_staff_user)):
    await db.units.delete_one({"id": unit_id})
    return {"message": "Unidade removida"}

# ==================== SERVICES ROUTES ====================

@api_router.get("/services")
async def get_services():
    services = await db.services.find().to_list(100)
    # Return without price for patients
    return [{"id": s["id"], "name": s["name"], "description": s["description"], "duration_minutes": s["duration_minutes"]} for s in services]

@admin_router.get("/services")
async def get_services_admin(current_user: dict = Depends(get_staff_user)):
    services = await db.services.find().to_list(100)
    return [Service(**s) for s in services]

@admin_router.post("/services")
async def create_service(service_data: ServiceCreate, current_user: dict = Depends(get_staff_user)):
    service_id = str(uuid.uuid4())
    service_dict = {"id": service_id, **service_data.dict()}
    await db.services.insert_one(service_dict)
    return Service(**service_dict)

@admin_router.put("/services/{service_id}")
async def update_service(service_id: str, service_data: ServiceUpdate, current_user: dict = Depends(get_staff_user)):
    update_dict = {k: v for k, v in service_data.dict().items() if v is not None}
    if update_dict:
        await db.services.update_one({"id": service_id}, {"$set": update_dict})
    service = await db.services.find_one({"id": service_id})
    return Service(**service)

@admin_router.delete("/services/{service_id}")
async def delete_service(service_id: str, current_user: dict = Depends(get_staff_user)):
    await db.services.delete_one({"id": service_id})
    return {"message": "Serviço removido"}

# ==================== DOCTORS ROUTES ====================

@api_router.get("/doctors")
async def get_doctors(unit_id: Optional[str] = None):
    query = {"unit_id": unit_id} if unit_id else {}
    doctors = await db.doctors.find(query).to_list(100)
    return [Doctor(**d) for d in doctors]

@admin_router.get("/doctors")
async def get_doctors_admin(current_user: dict = Depends(get_staff_user)):
    doctors = await db.doctors.find().to_list(100)
    return [Doctor(**d) for d in doctors]

@admin_router.post("/doctors")
async def create_doctor(doctor_data: DoctorCreate, current_user: dict = Depends(get_staff_user)):
    doctor_id = str(uuid.uuid4())
    doctor_dict = {"id": doctor_id, **doctor_data.dict()}
    await db.doctors.insert_one(doctor_dict)
    return Doctor(**doctor_dict)

@admin_router.put("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, doctor_data: DoctorUpdate, current_user: dict = Depends(get_staff_user)):
    update_dict = {k: v for k, v in doctor_data.dict().items() if v is not None}
    if update_dict:
        await db.doctors.update_one({"id": doctor_id}, {"$set": update_dict})
    doctor = await db.doctors.find_one({"id": doctor_id})
    return Doctor(**doctor)

@admin_router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, current_user: dict = Depends(get_staff_user)):
    await db.doctors.delete_one({"id": doctor_id})
    return {"message": "Doutor removido"}

# ==================== APPOINTMENTS ROUTES ====================

@api_router.get("/appointments/booked-slots")
async def get_booked_slots(doctor_id: str, date: str):
    """Get booked time slots for a doctor on a specific date"""
    appointments = await db.appointments.find({
        "doctor_id": doctor_id,
        "date": date,
        "status": {"$ne": "cancelado"}
    }).to_list(100)
    
    booked_times = [apt["time"] for apt in appointments]
    return {"booked_times": booked_times, "date": date, "doctor_id": doctor_id}

@api_router.post("/appointments")
async def create_appointment(appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    unit = await db.units.find_one({"id": appointment.unit_id})
    service = await db.services.find_one({"id": appointment.service_id})
    doctor = await db.doctors.find_one({"id": appointment.doctor_id})
    
    if not unit or not service or not doctor:
        raise HTTPException(status_code=400, detail="Dados inválidos")
    
    # Server-side validation: Check for past date/time (Brazil UTC-3)
    now_brazil = get_brazil_now()
    apt_date = parse_br_date(appointment.date)
    if apt_date:
        try:
            hour, minute = appointment.time.split(":")
            apt_datetime = apt_date.replace(hour=int(hour), minute=int(minute))
            if apt_datetime < now_brazil:
                raise HTTPException(status_code=400, detail="Não é possível agendar em horários passados")
        except ValueError:
            pass
    
    # Server-side validation: Check for double booking
    existing = await db.appointments.find_one({
        "doctor_id": appointment.doctor_id,
        "date": appointment.date,
        "time": appointment.time,
        "status": {"$ne": "cancelado"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Este horário já está ocupado para o profissional selecionado")
    
    appointment_id = str(uuid.uuid4())
    appointment_dict = {
        "id": appointment_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", ""),
        "user_cpf": current_user.get("cpf", ""),
        "unit_id": appointment.unit_id,
        "unit_name": unit["name"],
        "service_id": appointment.service_id,
        "service_name": service["name"],
        "service_price": service.get("price", 0),
        "doctor_id": appointment.doctor_id,
        "doctor_name": doctor["name"],
        "date": appointment.date,
        "time": appointment.time,
        "status": "agendado",
        "notes": appointment.notes or "",
        "paid_value": 0,
        "created_at": datetime.utcnow()
    }
    await db.appointments.insert_one(appointment_dict)
    
    # Emit real-time event to admin
    await emit_to_admin('new_appointment', {
        "id": appointment_id,
        "patient_name": current_user.get("name", ""),
        "doctor_name": doctor["name"],
        "unit_name": unit["name"],
        "service_name": service["name"],
        "date": appointment.date,
        "time": appointment.time,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return AppointmentResponse(**appointment_dict)

@api_router.get("/appointments")
async def get_appointments(current_user: dict = Depends(get_current_user)):
    appointments = await db.appointments.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return [AppointmentResponse(**apt) for apt in appointments]

@api_router.delete("/appointments/{appointment_id}")
async def cancel_appointment(appointment_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.appointments.update_one(
        {"id": appointment_id, "user_id": current_user["id"]},
        {"$set": {"status": "cancelado"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    # Emit to admin
    apt = await db.appointments.find_one({"id": appointment_id})
    if apt:
        await emit_to_admin('appointment_cancelled', {
            "id": appointment_id,
            "patient_name": apt.get("user_name", ""),
            "date": apt.get("date", ""),
            "time": apt.get("time", ""),
            "timestamp": datetime.utcnow().isoformat()
        })
    
    return {"message": "Agendamento cancelado"}

# Admin appointments
@admin_router.get("/appointments")
async def get_all_appointments(
    status: Optional[str] = None,
    date: Optional[str] = None,
    doctor_id: Optional[str] = None,
    unit_id: Optional[str] = None,
    current_user: dict = Depends(get_staff_user)
):
    query = {}
    if status:
        query["status"] = status
    if date:
        query["date"] = date
    if doctor_id:
        query["doctor_id"] = doctor_id
    if unit_id:
        query["unit_id"] = unit_id
    
    appointments = await db.appointments.find(query).sort("date", -1).to_list(500)
    return [AppointmentResponse(**apt) for apt in appointments]

@admin_router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, data: AppointmentUpdate, current_user: dict = Depends(get_staff_user)):
    update_dict = {k: v for k, v in data.dict().items() if v is not None}
    
    if "status" in update_dict and update_dict["status"] == "concluido":
        # Get appointment to add to financial
        apt = await db.appointments.find_one({"id": appointment_id})
        if apt:
            paid_value = update_dict.get("paid_value", apt.get("service_price", 0))
            update_dict["paid_value"] = paid_value
            update_dict["completed_at"] = datetime.utcnow()
    
    if update_dict:
        await db.appointments.update_one({"id": appointment_id}, {"$set": update_dict})
    
    apt = await db.appointments.find_one({"id": appointment_id})
    
    # Emit status change to admin and patient
    if apt:
        await emit_to_admin('appointment_updated', {
            "id": appointment_id,
            "status": apt.get("status"),
            "patient_name": apt.get("user_name", ""),
            "timestamp": datetime.utcnow().isoformat()
        })
        # Notify patient
        await emit_to_patient(apt.get("user_id"), 'appointment_status_changed', {
            "id": appointment_id,
            "status": apt.get("status"),
            "date": apt.get("date", ""),
            "time": apt.get("time", ""),
        })
    
    return AppointmentResponse(**apt)

# ==================== NOTIFICATION ROUTES ====================

@api_router.get("/appointments/reminders")
async def get_upcoming_reminders(current_user: dict = Depends(get_current_user)):
    """Get appointments within the next 24 hours for push notification"""
    now_brazil = get_brazil_now()
    tomorrow = now_brazil + timedelta(hours=24)
    
    appointments = await db.appointments.find({
        "user_id": current_user["id"],
        "status": "agendado"
    }).to_list(100)
    
    reminders = []
    for apt in appointments:
        apt_date = parse_br_date(apt.get("date", ""))
        if apt_date:
            try:
                hour, minute = apt.get("time", "00:00").split(":")
                apt_datetime = apt_date.replace(hour=int(hour), minute=int(minute))
                if now_brazil < apt_datetime <= tomorrow:
                    reminders.append({
                        "id": apt["id"],
                        "date": apt["date"],
                        "time": apt["time"],
                        "doctor_name": apt.get("doctor_name", ""),
                        "service_name": apt.get("service_name", ""),
                        "unit_name": apt.get("unit_name", ""),
                    })
            except (ValueError, AttributeError):
                pass
    
    return {"reminders": reminders}

# ==================== FINANCIAL ROUTES ====================

@admin_router.get("/financial/summary")
async def get_financial_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    unit_id: Optional[str] = None,
    current_user: dict = Depends(get_staff_user)
):
    now = datetime.utcnow()
    target_month = month or now.month
    target_year = year or now.year
    
    # Get completed appointments
    query = {"status": "concluido"}
    if unit_id:
        query["unit_id"] = unit_id
    
    appointments = await db.appointments.find(query).to_list(1000)
    
    # Filter by month/year based on date string (DD/MM/YYYY)
    monthly_total = 0
    monthly_appointments = []
    
    # Per-clinic breakdown
    clinic_totals = {}
    
    for apt in appointments:
        try:
            date_parts = apt["date"].split("/")
            if len(date_parts) == 3:
                apt_month = int(date_parts[1])
                apt_year = int(date_parts[2])
                if apt_month == target_month and apt_year == target_year:
                    paid = apt.get("paid_value", 0)
                    monthly_total += paid
                    monthly_appointments.append(apt)
                    
                    # Per-clinic
                    clinic_name = apt.get("unit_name", "Sem unidade")
                    clinic_id = apt.get("unit_id", "")
                    if clinic_id not in clinic_totals:
                        clinic_totals[clinic_id] = {
                            "unit_id": clinic_id,
                            "unit_name": clinic_name,
                            "total_revenue": 0,
                            "total_appointments": 0
                        }
                    clinic_totals[clinic_id]["total_revenue"] += paid
                    clinic_totals[clinic_id]["total_appointments"] += 1
        except Exception:
            pass
    
    avg_ticket = monthly_total / len(monthly_appointments) if monthly_appointments else 0
    
    return {
        "month": target_month,
        "year": target_year,
        "total_revenue": monthly_total,
        "total_appointments": len(monthly_appointments),
        "average_ticket": avg_ticket,
        "clinic_breakdown": list(clinic_totals.values()),
        "appointments": [AppointmentResponse(**a) for a in monthly_appointments]
    }

@admin_router.get("/financial/daily")
async def get_daily_financial(date: str, current_user: dict = Depends(get_staff_user)):
    appointments = await db.appointments.find({
        "date": date,
        "status": "concluido"
    }).to_list(100)
    
    total = sum(apt.get("paid_value", 0) for apt in appointments)
    
    return {
        "date": date,
        "total_revenue": total,
        "appointments": [AppointmentResponse(**a) for a in appointments]
    }

# ==================== INVENTORY ROUTES ====================

@admin_router.get("/inventory")
async def get_inventory(current_user: dict = Depends(get_staff_user)):
    items = await db.inventory.find().to_list(500)
    return serialize_docs(items)

@admin_router.post("/inventory")
async def create_inventory_item(item_data: InventoryItemCreate, current_user: dict = Depends(get_staff_user)):
    item_id = str(uuid.uuid4())
    item_dict = {
        "id": item_id,
        **item_data.dict(),
        "created_at": datetime.utcnow()
    }
    await db.inventory.insert_one(item_dict)

    # Log movement
    await db.inventory_movements.insert_one({
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "item_name": item_data.name,
        "type": "entrada",
        "quantity": item_data.quantity,
        "doctor_id": None,
        "doctor_name": current_user.get("name", ""),
        "notes": "Cadastro inicial",
        "created_at": datetime.utcnow(),
        "created_by": current_user.get("name", "")
    })

    return serialize_doc(item_dict)

@admin_router.put("/inventory/{item_id}")
async def update_inventory_item(item_id: str, item_data: InventoryItemUpdate, current_user: dict = Depends(get_staff_user)):
    update_dict = {k: v for k, v in item_data.dict().items() if v is not None}
    if update_dict:
        await db.inventory.update_one({"id": item_id}, {"$set": update_dict})
    item = await db.inventory.find_one({"id": item_id})
    return serialize_doc(item)

@admin_router.post("/inventory/movement")
async def add_inventory_movement(movement: InventoryMovement, current_user: dict = Depends(get_staff_user)):
    item = await db.inventory.find_one({"id": movement.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    doctor_name = ""
    if movement.doctor_id:
        doctor = await db.doctors.find_one({"id": movement.doctor_id})
        doctor_name = doctor["name"] if doctor else ""
    
    # Update quantity
    new_quantity = item["quantity"]
    if movement.type == "entrada":
        new_quantity += movement.quantity
    elif movement.type == "saida":
        if item["quantity"] < movement.quantity:
            raise HTTPException(status_code=400, detail="Quantidade insuficiente em estoque")
        new_quantity -= movement.quantity
    
    await db.inventory.update_one({"id": movement.item_id}, {"$set": {"quantity": new_quantity}})
    
    # Log movement
    movement_dict = {
        "id": str(uuid.uuid4()),
        "item_id": movement.item_id,
        "item_name": item["name"],
        "type": movement.type,
        "quantity": movement.quantity,
        "doctor_id": movement.doctor_id,
        "doctor_name": doctor_name,
        "notes": movement.notes,
        "created_at": datetime.utcnow(),
        "created_by": current_user.get("name", "")
    }
    await db.inventory_movements.insert_one(movement_dict)

    return serialize_doc(movement_dict)

@admin_router.get("/inventory/movements")
async def get_inventory_movements(
    item_id: Optional[str] = None,
    type: Optional[str] = None,
    doctor_id: Optional[str] = None,
    current_user: dict = Depends(get_staff_user)
):
    query = {}
    if item_id:
        query["item_id"] = item_id
    if type:
        query["type"] = type
    if doctor_id:
        query["doctor_id"] = doctor_id
    
    movements = await db.inventory_movements.find(query).sort("created_at", -1).to_list(500)
    return serialize_docs(movements)

# ==================== PATIENTS ROUTES ====================

@admin_router.get("/patients")
async def get_all_patients(current_user: dict = Depends(get_staff_user)):
    patients = await db.users.find().sort("name", 1).to_list(1000)
    return [UserResponse(**{
        "id": p["id"],
        "name": p["name"],
        "cpf": p["cpf"],
        "birth_date": p["birth_date"],
        "phone": p.get("phone", ""),
        "address": p.get("address", ""),
        "gender": p.get("gender", ""),
        "associate": p.get("associate", ""),
        "company": p.get("company", ""),
        "created_at": p["created_at"]
    }) for p in patients]

@admin_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, current_user: dict = Depends(get_staff_user)):
    patient = await db.users.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    
    # Get patient appointments
    appointments = await db.appointments.find({"user_id": patient_id}).sort("created_at", -1).to_list(100)
    
    # Separate into history and upcoming
    now_brazil = get_brazil_now()
    history = []
    upcoming = []
    
    for apt in appointments:
        apt_resp = AppointmentResponse(**apt)
        apt_date = parse_br_date(apt.get("date", ""))
        if apt_date:
            try:
                hour, minute = apt.get("time", "00:00").split(":")
                apt_datetime = apt_date.replace(hour=int(hour), minute=int(minute))
                if apt_datetime < now_brazil or apt.get("status") in ["concluido", "cancelado"]:
                    history.append(apt_resp)
                else:
                    upcoming.append(apt_resp)
            except (ValueError, AttributeError):
                history.append(apt_resp)
        else:
            history.append(apt_resp)
    
    return {
        "patient": UserResponse(**{
            "id": patient["id"],
            "name": patient["name"],
            "cpf": patient["cpf"],
            "birth_date": patient["birth_date"],
            "phone": patient.get("phone", ""),
            "address": patient.get("address", ""),
            "gender": patient.get("gender", ""),
            "associate": patient.get("associate", ""),
            "company": patient.get("company", ""),
            "created_at": patient["created_at"]
        }),
        "history": history,
        "upcoming": upcoming,
        "appointments": [AppointmentResponse(**a) for a in appointments]
    }

@admin_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, data: PatientUpdate, current_user: dict = Depends(get_staff_user)):
    update_dict = {k: v for k, v in data.dict().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    result = await db.users.update_one({"id": patient_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    
    patient = await db.users.find_one({"id": patient_id})
    return UserResponse(**{
        "id": patient["id"],
        "name": patient["name"],
        "cpf": patient["cpf"],
        "birth_date": patient["birth_date"],
        "phone": patient.get("phone", ""),
        "address": patient.get("address", ""),
        "gender": patient.get("gender", ""),
        "associate": patient.get("associate", ""),
        "company": patient.get("company", ""),
        "created_at": patient["created_at"]
    })

# ==================== DOCUMENT TEMPLATES ROUTES ====================

@admin_router.get("/document-templates")
async def get_document_templates(current_user: dict = Depends(get_staff_user)):
    templates = await db.document_templates.find().to_list(10)
    return serialize_docs(templates)

@admin_router.put("/document-templates/{template_type}")
async def update_document_template(template_type: str, data: DocumentTemplateUpdate, current_user: dict = Depends(get_staff_user)):
    await db.document_templates.update_one(
        {"type": template_type},
        {"$set": {"content": data.content, "updated_at": datetime.utcnow()}}
    )
    template = await db.document_templates.find_one({"type": template_type})
    return serialize_doc(template)

@admin_router.post("/documents/generate")
async def generate_document(data: DocumentGenerate, current_user: dict = Depends(get_staff_user)):
    template = await db.document_templates.find_one({"type": data.template_type})
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    patient = await db.users.find_one({"id": data.patient_id})
    doctor = await db.doctors.find_one({"id": data.doctor_id})
    unit = await db.units.find_one({"id": doctor["unit_id"]}) if doctor else None
    
    if not patient or not doctor:
        raise HTTPException(status_code=404, detail="Paciente ou doutor não encontrado")
    
    # Replace placeholders
    content = template["content"]
    now = datetime.now()
    
    replacements = {
        "{NOME_PACIENTE}": patient["name"],
        "{CPF_PACIENTE}": patient["cpf"],
        "{NOME_DOUTOR}": doctor["name"],
        "{CRO_DOUTOR}": doctor.get("cro", ""),
        "{DATA}": now.strftime("%d/%m/%Y"),
        "{DATA_EXTENSO}": now.strftime("%d de %B de %Y").replace("January", "Janeiro").replace("February", "Fevereiro").replace("March", "Março").replace("April", "Abril").replace("May", "Maio").replace("June", "Junho").replace("July", "Julho").replace("August", "Agosto").replace("September", "Setembro").replace("October", "Outubro").replace("November", "Novembro").replace("December", "Dezembro"),
        "{CIDADE}": "Manaus - AM",
        "{NOME_CLINICA}": "Odonto Sinditur",
        "{ENDERECO_CLINICA}": unit["address"] if unit else "",
        "{DIAS_AFASTAMENTO}": str(data.custom_fields.get("dias_afastamento", "1")),
        "{DATA_INICIO}": data.custom_fields.get("data_inicio", now.strftime("%d/%m/%Y")),
        "{DATA_FIM}": data.custom_fields.get("data_fim", ""),
        "{PROCEDIMENTOS}": data.custom_fields.get("procedimentos", ""),
        "{PROCEDIMENTO}": data.custom_fields.get("procedimento", ""),
        "{MEDICAMENTOS}": data.custom_fields.get("medicamentos", ""),
        "{OBSERVACOES}": data.custom_fields.get("observacoes", ""),
    }
    
    for key, value in replacements.items():
        content = content.replace(key, str(value))
    
    return {
        "content": content,
        "template_type": data.template_type,
        "patient_name": patient["name"],
        "doctor_name": doctor["name"],
        "doctor_cro": doctor.get("cro", ""),
        "generated_at": now.isoformat()
    }

@admin_router.post("/documents/generate-pdf")
async def generate_document_pdf(data: DocumentGenerate, current_user: dict = Depends(get_staff_user)):
    # First generate the content
    template = await db.document_templates.find_one({"type": data.template_type})
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    patient = await db.users.find_one({"id": data.patient_id})
    doctor = await db.doctors.find_one({"id": data.doctor_id})
    unit = await db.units.find_one({"id": doctor["unit_id"]}) if doctor else None
    
    if not patient or not doctor:
        raise HTTPException(status_code=404, detail="Paciente ou doutor não encontrado")
    
    content = template["content"]
    now = datetime.now()
    
    meses_pt = {
        "January": "Janeiro", "February": "Fevereiro", "March": "Março",
        "April": "Abril", "May": "Maio", "June": "Junho",
        "July": "Julho", "August": "Agosto", "September": "Setembro",
        "October": "Outubro", "November": "Novembro", "December": "Dezembro"
    }
    
    data_extenso = now.strftime("%d de %B de %Y")
    for en, pt in meses_pt.items():
        data_extenso = data_extenso.replace(en, pt)
    
    replacements = {
        "{NOME_PACIENTE}": patient["name"],
        "{CPF_PACIENTE}": patient["cpf"],
        "{NOME_DOUTOR}": doctor["name"],
        "{CRO_DOUTOR}": doctor.get("cro", ""),
        "{DATA}": now.strftime("%d/%m/%Y"),
        "{DATA_EXTENSO}": data_extenso,
        "{CIDADE}": "Manaus - AM",
        "{NOME_CLINICA}": "Odonto Sinditur",
        "{ENDERECO_CLINICA}": unit["address"] if unit else "",
        "{DIAS_AFASTAMENTO}": str(data.custom_fields.get("dias_afastamento", "1")),
        "{DATA_INICIO}": data.custom_fields.get("data_inicio", now.strftime("%d/%m/%Y")),
        "{DATA_FIM}": data.custom_fields.get("data_fim", ""),
        "{PROCEDIMENTOS}": data.custom_fields.get("procedimentos", ""),
        "{PROCEDIMENTO}": data.custom_fields.get("procedimento", ""),
        "{MEDICAMENTOS}": data.custom_fields.get("medicamentos", ""),
        "{OBSERVACOES}": data.custom_fields.get("observacoes", ""),
    }
    
    for key, value in replacements.items():
        content = content.replace(key, str(value))
    
    # Generate PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=14, spaceAfter=20)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], alignment=TA_JUSTIFY, fontSize=12, leading=18, spaceAfter=12)
    signature_style = ParagraphStyle('Signature', parent=styles['Normal'], alignment=TA_CENTER, fontSize=12, spaceBefore=40)
    
    story = []
    
    # Header
    story.append(Paragraph("ODONTO SINDITUR", title_style))
    story.append(Spacer(1, 20))
    
    # Content
    lines = content.split('\n')
    for line in lines:
        if line.strip():
            if line.startswith('_'):
                story.append(Paragraph(line, signature_style))
            else:
                story.append(Paragraph(line, body_style))
        else:
            story.append(Spacer(1, 12))
    
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    pdf_base64 = base64.b64encode(pdf_bytes).decode()
    
    return {
        "pdf_base64": pdf_base64,
        "filename": f"{data.template_type}_{patient['name'].replace(' ', '_')}_{now.strftime('%Y%m%d')}.pdf"
    }

# ==================== ROOT ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Dental Clinic API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include routers
fastapi_app.include_router(api_router)
fastapi_app.include_router(admin_router)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@fastapi_app.on_event("startup")
async def startup_event():
    await seed_data()

@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Wrap FastAPI with Socket.IO - this is the ASGI app uvicorn will load
app = socketio.ASGIApp(sio, fastapi_app)
